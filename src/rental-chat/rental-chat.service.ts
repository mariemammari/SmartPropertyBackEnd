import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Rental, RentalDocument } from '../rental/schemas/rental.schema';
import {
  RentalConversation,
  RentalConversationDocument,
  RentalConversationType,
} from './schemas/rental-conversation.schema';
import {
  RentalMessage,
  RentalMessageDocument,
  MessageVisibility,
  UserRole,
} from './schemas/rental-message.schema';

@Injectable()
export class RentalChatService {
  constructor(
    @InjectModel(Rental.name) private rentalModel: Model<RentalDocument>,
    @InjectModel(RentalConversation.name)
    private conversationModel: Model<RentalConversationDocument>,
    @InjectModel(RentalMessage.name)
    private messageModel: Model<RentalMessageDocument>,
  ) {}

  private async getRentalOrThrow(rentalId: string): Promise<RentalDocument> {
    const rental = await this.rentalModel.findById(rentalId).exec();
    if (!rental) throw new NotFoundException('Rental not found');
    return rental;
  }

  private buildParticipantsByType(
    rental: RentalDocument,
    conversationType: RentalConversationType,
  ): Types.ObjectId[] {
    const agentId = rental.agentId;
    const ownerId = rental.ownerId;
    const tenantId = rental.tenantId;

    if (!agentId) {
      throw new BadRequestException(
        'Rental is missing agentId required for chat',
      );
    }

    if (conversationType === RentalConversationType.AGENT_OWNER) {
      if (!ownerId)
        throw new BadRequestException(
          'Rental is missing ownerId required for agent-owner chat',
        );
      return [agentId, ownerId];
    }

    if (!tenantId)
      throw new BadRequestException(
        'Rental is missing tenantId required for agent-tenant chat',
      );
    return [agentId, tenantId];
  }

  private hasSameParticipants(
    conversation: RentalConversationDocument,
    expectedParticipants: Types.ObjectId[],
  ): boolean {
    if (conversation.participants.length !== expectedParticipants.length) {
      return false;
    }

    const expectedIds = new Set(
      expectedParticipants.map((id) => id.toString()),
    );
    return conversation.participants.every((participantId) =>
      expectedIds.has(participantId.toString()),
    );
  }

  private isParticipant(
    conversation: RentalConversationDocument,
    userId: string,
  ): boolean {
    const userObjectId = new Types.ObjectId(userId);
    return conversation.participants.some((participantId) =>
      participantId.equals(userObjectId),
    );
  }

  private async getUserRole(
    rentalId: string,
    userId: string,
  ): Promise<UserRole | null> {
    const rental = await this.rentalModel.findById(rentalId).exec();
    if (!rental) {
      return null;
    }

    const userObjectId = new Types.ObjectId(userId);

    if (rental.agentId?.equals(userObjectId)) return UserRole.AGENT;
    if (rental.tenantId?.equals(userObjectId)) return UserRole.TENANT;
    if (rental.ownerId?.equals(userObjectId)) return UserRole.OWNER;

    return null;
  }

  private canUserSeeMessage(
    message: RentalMessageDocument,
    userRole: UserRole | null,
    userId: string,
  ): boolean {
    if (!userRole) return false;

    const visibility = message.visibleTo ?? MessageVisibility.ALL;
    if (visibility === MessageVisibility.ALL) return true;
    if (visibility === MessageVisibility.AGENT_ONLY)
      return userRole === UserRole.AGENT;
    if (visibility === MessageVisibility.TENANT_ONLY)
      return userRole === UserRole.TENANT;
    if (visibility === MessageVisibility.OWNER_ONLY)
      return userRole === UserRole.OWNER;

    const userObjectId = new Types.ObjectId(userId);
    if (message.visibleToUsers?.some((id) => id.equals(userObjectId)))
      return true;

    return false;
  }

  async getOrCreateConversation(
    rentalId: string,
    conversationType: RentalConversationType,
  ): Promise<RentalConversationDocument> {
    const rental = await this.getRentalOrThrow(rentalId);
    const expectedParticipants = this.buildParticipantsByType(
      rental,
      conversationType,
    );

    let conversation = await this.conversationModel
      .findOne({
        rentalId: rental._id,
        conversationType,
        participants: {
          $all: expectedParticipants,
          $size: expectedParticipants.length,
        },
      })
      .sort({ updatedAt: -1 })
      .exec();

    if (!conversation) {
      conversation = await this.conversationModel.create({
        rentalId: rental._id,
        conversationType,
        participants: expectedParticipants,
      });
    } else if (!this.hasSameParticipants(conversation, expectedParticipants)) {
      // Safety net for any legacy records that do not match expected participants.
      conversation = await this.conversationModel.create({
        rentalId: rental._id,
        conversationType,
        participants: expectedParticipants,
      });
    }

    return conversation;
  }

  async getOrCreateConversationPair(rentalId: string): Promise<{
    agentOwner: RentalConversationDocument;
    agentTenant: RentalConversationDocument;
  }> {
    const [agentOwner, agentTenant] = await Promise.all([
      this.getOrCreateConversation(
        rentalId,
        RentalConversationType.AGENT_OWNER,
      ),
      this.getOrCreateConversation(
        rentalId,
        RentalConversationType.AGENT_TENANT,
      ),
    ]);

    return { agentOwner, agentTenant };
  }

  async getConversationsForRental(
    rentalId: string,
    userId: string,
  ): Promise<RentalConversationDocument[]> {
    await this.getRentalOrThrow(rentalId);

    const visibleConversations: RentalConversationDocument[] = [];
    const conversationTypes = [
      RentalConversationType.AGENT_OWNER,
      RentalConversationType.AGENT_TENANT,
    ];

    for (const conversationType of conversationTypes) {
      try {
        const conversation = await this.getOrCreateConversation(
          rentalId,
          conversationType,
        );
        if (this.isParticipant(conversation, userId)) {
          visibleConversations.push(conversation);
        }
      } catch (error) {
        // Allow rentals that do not yet have tenant/owner fully assigned.
        if (!(error instanceof BadRequestException)) {
          throw error;
        }
      }
    }

    return visibleConversations.sort((a, b) => {
      const left = a.updatedAt ? a.updatedAt.getTime() : 0;
      const right = b.updatedAt ? b.updatedAt.getTime() : 0;
      return right - left;
    });
  }

  async getMessages(
    conversationId: string,
    userId: string,
  ): Promise<RentalMessageDocument[]> {
    const conversation = await this.conversationModel
      .findById(conversationId)
      .exec();
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (!this.isParticipant(conversation, userId)) {
      throw new ForbiddenException(
        'User is not a participant in this conversation',
      );
    }

    const userRole = await this.getUserRole(
      conversation.rentalId.toString(),
      userId,
    );
    if (!userRole) {
      throw new ForbiddenException('User role not found for this rental');
    }

    const messages = await this.messageModel
      .find({ conversationId: new Types.ObjectId(conversationId) })
      .sort({ createdAt: 1 })
      .exec();

    return messages.filter((msg) =>
      this.canUserSeeMessage(msg, userRole, userId),
    );
  }

  async sendMessage(
    conversationId: string,
    senderId: string,
    content: string,
    visibleTo?: MessageVisibility,
  ): Promise<RentalMessageDocument> {
    const conversation = await this.conversationModel
      .findById(conversationId)
      .exec();
    if (!conversation) throw new NotFoundException('Conversation not found');

    if (!this.isParticipant(conversation, senderId)) {
      throw new ForbiddenException(
        'Sender is not a participant in this conversation',
      );
    }

    const senderRole = await this.getUserRole(
      conversation.rentalId.toString(),
      senderId,
    );
    if (!senderRole)
      throw new ForbiddenException('Sender role not found for this rental');

    const message = await this.messageModel.create({
      conversationId: new Types.ObjectId(conversationId),
      senderId: new Types.ObjectId(senderId),
      content,
      visibleTo: visibleTo ?? MessageVisibility.ALL,
      senderRole,
      readBy: [new Types.ObjectId(senderId)],
    });

    await this.conversationModel.findByIdAndUpdate(conversationId, {
      lastMessage: message._id,
      updatedAt: new Date(),
    });

    return message;
  }
}
