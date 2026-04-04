import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Rental, RentalDocument } from '../rental/schemas/rental.schema';
import { RentalConversation, RentalConversationDocument } from './schemas/rental-conversation.schema';
import { RentalMessage, RentalMessageDocument, MessageVisibility } from './schemas/rental-message.schema';

enum UserRole {
    AGENT = 'agent',
    TENANT = 'tenant',
    OWNER = 'owner',
}

@Injectable()
export class RentalChatService {
    constructor(
        @InjectModel(Rental.name) private rentalModel: Model<RentalDocument>,
        @InjectModel(RentalConversation.name) private conversationModel: Model<RentalConversationDocument>,
        @InjectModel(RentalMessage.name) private messageModel: Model<RentalMessageDocument>,
    ) { }

    async getOrCreateConversation(rentalId: string): Promise<RentalConversationDocument> {
        const rental = await this.rentalModel.findById(rentalId).exec();
        if (!rental) throw new NotFoundException('Rental not found');

        const participants = [rental.ownerId, rental.tenantId, rental.agentId].filter(Boolean) as Types.ObjectId[];

        let conversation = await this.conversationModel.findOne({ rentalId: rental._id }).exec();
        if (!conversation) {
            conversation = await this.conversationModel.create({
                rentalId: rental._id,
                participants,
            });
        }

        return conversation;
    }

    private async getUserRole(rentalId: string, userId: string): Promise<UserRole | null> {
        const rental = await this.rentalModel.findById(rentalId).exec();
        if (!rental) {
            console.log(`❌ [getUserRole] Rental not found: ${rentalId}`);
            return null;
        }

        const userObjectId = new Types.ObjectId(userId);
        console.log(`🔍 [getUserRole] Checking userId: ${userId}`);
        console.log(`  - Agent: ${rental.agentId?.toString()}, Tenant: ${rental.tenantId?.toString()}, Owner: ${rental.ownerId?.toString()}`);

        if (rental.agentId?.equals(userObjectId)) {
            console.log(`✅ [getUserRole] User is AGENT`);
            return UserRole.AGENT;
        }
        if (rental.tenantId?.equals(userObjectId)) {
            console.log(`✅ [getUserRole] User is TENANT`);
            return UserRole.TENANT;
        }
        if (rental.ownerId?.equals(userObjectId)) {
            console.log(`✅ [getUserRole] User is OWNER`);
            return UserRole.OWNER;
        }

        console.log(`❌ [getUserRole] User ${userId} is not a participant`);
        return null;
    }

    private canUserSeeMessage(message: RentalMessageDocument, userRole: UserRole | null): boolean {
        if (!userRole) return false;

        const visibility = message.visibleTo ?? MessageVisibility.ALL;

        if (visibility === MessageVisibility.ALL) return true;
        if (visibility === MessageVisibility.AGENT_ONLY) return userRole === UserRole.AGENT;
        if (visibility === MessageVisibility.TENANT_ONLY) return userRole === UserRole.TENANT;
        if (visibility === MessageVisibility.OWNER_ONLY) return userRole === UserRole.OWNER;
        if (message.visibleToUsers?.some(id => id.equals(new Types.ObjectId(userRole)))) return true;

        return false;
    }

    async getMessages(conversationId: string, userId: string): Promise<RentalMessageDocument[]> {
        console.log(`🔷 [getMessages] Fetching for conversationId: ${conversationId}, userId: ${userId}`);

        const conversation = await this.conversationModel.findById(conversationId).exec();
        if (!conversation) {
            console.log(`❌ [getMessages] Conversation not found`);
            throw new NotFoundException('Conversation not found');
        }

        console.log(`✅ [getMessages] Found conversation, checking user role...`);
        const userRole = await this.getUserRole(conversation.rentalId.toString(), userId);

        if (!userRole) {
            console.log(`❌ [getMessages] User not a participant`);
            throw new ForbiddenException('User is not a participant in this conversation');
        }

        const messages = await this.messageModel
            .find({ conversationId: new Types.ObjectId(conversationId) })
            .sort({ createdAt: 1 })
            .exec();

        console.log(`📊 [getMessages] Total messages: ${messages.length}`);

        // For now, return ALL messages (debug mode)
        // Filter messages based on user's role and message visibility
        const filtered = messages.filter(msg => this.canUserSeeMessage(msg, userRole));
        console.log(`✅ [getMessages] Filtered to ${filtered.length} visible messages for role ${userRole}`);

        return filtered;
    }

    async sendMessage(
        conversationId: string,
        senderId: string,
        content: string,
        visibleTo?: MessageVisibility,
    ): Promise<RentalMessageDocument> {
        const conversation = await this.conversationModel.findById(conversationId).exec();
        if (!conversation) throw new NotFoundException('Conversation not found');

        const senderRole = await this.getUserRole(conversation.rentalId.toString(), senderId);
        if (!senderRole) throw new ForbiddenException('Sender is not a participant in this conversation');

        const message = await this.messageModel.create({
            conversationId: new Types.ObjectId(conversationId),
            senderId: new Types.ObjectId(senderId),
            content,
            visibleTo: visibleTo ?? MessageVisibility.ALL,
            readBy: [new Types.ObjectId(senderId)],
        });

        await this.conversationModel.findByIdAndUpdate(conversationId, {
            lastMessage: message._id,
            updatedAt: new Date(),
        });

        console.log(`✅ [RentalChatService.sendMessage] Message created:`, message._id, 'visibleTo:', visibleTo ?? MessageVisibility.ALL);
        return message;
    }
}
