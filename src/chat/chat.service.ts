import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Conversation, ConversationDocument } from './schemas/conversation.schema';
import { Message, MessageDocument } from './schemas/message.schema';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Conversation.name) private conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
  ) {}

  async getOrCreateConversation(userId: string, peerId: string): Promise<ConversationDocument> {
    let conversation = await this.conversationModel.findOne({
      participants: { $all: [userId, peerId] },
    }).populate({
      path: 'participants',
      model: 'User',
      select: 'fullName email role photo lastSeen'
    }).populate('lastMessage');

    if (!conversation) {
      conversation = await this.conversationModel.create({
        participants: [userId, peerId],
      });
      // Populate after creation
      conversation = await this.conversationModel.findById(conversation._id)
        .populate({
          path: 'participants',
          model: 'User',
          select: 'fullName email role photo lastSeen'
        })
        .populate('lastMessage')
        .exec();
    }
    
    if (!conversation) {
      throw new NotFoundException('Conversation could not be created');
    }

    return conversation;
  }

  async getUserConversations(userId: string): Promise<any> {
    const conversations = await this.conversationModel.find({
      participants: userId,
    })
    .populate({
      path: 'participants',
      model: 'User',
      select: 'fullName email currentRole role photo lastSeen'
    })
    .populate('lastMessage')
    .sort({ updatedAt: -1 })
    .exec();

    return conversations;
  }

  async getMessages(conversationId: string): Promise<MessageDocument[]> {
    console.log(`[ChatService] Fetching messages for conversation: ${conversationId}`);
    const messages = await this.messageModel.find({ 
      conversationId: new Types.ObjectId(conversationId) 
    })
      .sort({ createdAt: 1 })
      .exec();
    console.log(`[ChatService] Found ${messages.length} messages`);
    return messages;
  }

  async getConversationById(conversationId: string): Promise<ConversationDocument | null> {
    return this.conversationModel.findById(conversationId)
      .populate('participants')
      .exec();
  }

  async saveMessage(conversationId: string, senderId: string, content: string): Promise<MessageDocument> {
    const message = await this.messageModel.create({
      conversationId: new Types.ObjectId(conversationId),
      sender: senderId,
      content,
      read: false, // Les nouveaux messages sont non lus par défaut
    });

    await this.conversationModel.findByIdAndUpdate(conversationId, {
      lastMessage: message._id.toString(),
      updatedAt: new Date()
    });

    return message;
  }

  async getUnreadCount(userId: string): Promise<number> {
    // Récupérer toutes les conversations de l'utilisateur
    const conversations = await this.conversationModel.find({
      participants: userId,
    }).select('_id').exec();

    const conversationIds = conversations.map(conv => conv._id);

    // Compter les messages non lus dans ces conversations (exclure les messages envoyés par l'utilisateur)
    const unreadCount = await this.messageModel.countDocuments({
      conversationId: { $in: conversationIds },
      sender: { $ne: userId },
      read: false,
    });

    return unreadCount;
  }

  async markAsRead(conversationId: string, userId: string): Promise<void> {
    // Marquer comme lus tous les messages dans la conversation qui ne sont pas de l'utilisateur
    const result = await this.messageModel.updateMany(
      {
        conversationId: new Types.ObjectId(conversationId),
        sender: { $ne: userId },
        read: false,
      },
      {
        read: true,
      }
    );

    // Si des messages ont été marqués comme lus, notifier l'autre participant
    if (result.modifiedCount > 0) {
      // Récupérer la conversation pour trouver l'autre participant
      const conversation = await this.getConversationById(conversationId);
      if (conversation) {
        const otherParticipant = conversation.participants.find(
          (p: any) => p.toString() !== userId
        );
        if (otherParticipant) {
          // TODO: Émettre un événement Socket.IO pour notifier que les messages sont lus
          // Ceci nécessite une référence au gateway ou un service d'événements
        }
      }
    }
  }
}
