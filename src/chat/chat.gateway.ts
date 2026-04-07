import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserDocument } from '../user/schemas/user.schema';
import { ChatService } from './chat.service';

interface UserSocketMap {
  [userId: string]: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedUsers: UserSocketMap = {};

  constructor(
    private readonly chatService: ChatService,
    @InjectModel('User') private userModel: Model<UserDocument>,
  ) {}

  async handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;

    // Check if userId is valid and not the string "undefined" or "null"
    if (userId && userId !== 'undefined' && userId !== 'null') {
      // Join a room for this user to support multiple connections (different components/tabs)
      client.join(userId);
      this.connectedUsers[userId] = client.id; // Still keep tracks of "active" for status simple checks

      console.log(
        `User ${userId} connected with socket ${client.id} and joined room ${userId}`,
      );

      try {
        // Update lastSeen and broadcast online status
        await this.userModel.findByIdAndUpdate(userId, {
          lastSeen: new Date(),
        });
        this.server.emit('userStatus', { userId, isOnline: true });

        // Send current online users to this specific client
        client.emit('initialStatuses', Object.keys(this.connectedUsers));
      } catch (error) {
        console.error(
          `Error updating status for user ${userId}:`,
          error.message,
        );
      }
    } else {
      console.warn(`Connection attempt with invalid userId: ${userId}`);
      // Optionally disconnect if you want strictly authenticated chat
      // client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = Object.keys(this.connectedUsers).find(
      (key) => this.connectedUsers[key] === client.id,
    );
    if (userId) {
      delete this.connectedUsers[userId];
      console.log(`User ${userId} disconnected`);

      // Update lastSeen and broadcast offline status
      const lastSeen = new Date();
      await this.userModel.findByIdAndUpdate(userId, { lastSeen });
      this.server.emit('userStatus', { userId, isOnline: false, lastSeen });
    }
  }

  @SubscribeMessage('checkStatus')
  handleCheckStatus(@MessageBody() payload: { userIds: string[] }) {
    const statuses = payload.userIds.map((id) => ({
      userId: id,
      isOnline: !!this.connectedUsers[id],
    }));
    return statuses;
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(
    @MessageBody()
    payload: {
      conversationId: string;
      senderId: string;
      content: string;
      receiverId: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    // Update sender's last activity
    await this.userModel.findByIdAndUpdate(payload.senderId, {
      lastSeen: new Date(),
    });
    // Save to database
    const message = await this.chatService.saveMessage(
      payload.conversationId,
      payload.senderId,
      payload.content,
    );

    // Broadcast to the sender via ack/emit back
    client.emit('receiveMessage', message);

    // Send to receiver room (all their sockets) if online
    if (this.connectedUsers[payload.receiverId]) {
      this.server.to(payload.receiverId).emit('receiveMessage', message);
      // Notifier le receiver d'un nouveau message pour incrémenter le compteur
      this.server.to(payload.receiverId).emit('newMessage', message);
      // Also notify about new message in conversation list
      this.server.to(payload.receiverId).emit('conversationUpdated', {
        conversationId: payload.conversationId,
        lastMessage: message,
      });
    }

    return message;
  }

  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(
    @MessageBody() payload: { conversationId: string; userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    // Marquer les messages comme lus dans la base de données
    await this.chatService.markAsRead(payload.conversationId, payload.userId);

    // Notifier l'autre participant que les messages ont été lus
    const conversation = await this.chatService.getConversationById(
      payload.conversationId,
    );
    if (conversation) {
      const otherParticipant = conversation.participants.find((p: any) => {
        const pId = p._id ? p._id.toString() : p.toString();
        return pId !== payload.userId;
      });
      if (otherParticipant) {
        const otherId = (otherParticipant as any)._id
          ? (otherParticipant as any)._id.toString()
          : otherParticipant.toString();
        this.server
          .to(otherId)
          .emit('messageRead', { conversationId: payload.conversationId });
      }
    }

    // Notifier TOUS les sockets de l'utilisateur actuel (propre room)
    this.server
      .to(payload.userId)
      .emit('messageRead', { conversationId: payload.conversationId });
  }
}
