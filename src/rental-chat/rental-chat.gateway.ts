import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { RentalChatService } from './rental-chat.service';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';

@WebSocketGateway({
  namespace: 'rental-chat',
  cors: {
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      'http://localhost:5174',
    ],
    credentials: true,
  },
})
export class RentalChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server!: Server;
  private logger = new Logger('RentalChatGateway');
  private userConnections: Map<
    string,
    { userId: string; conversationIds: Set<string> }
  > = new Map();

  constructor(private readonly rentalChatService: RentalChatService) {}

  afterInit() {
    this.logger.log('🔷 WebSocket gateway initialized for rental-chat');
  }

  handleConnection(client: Socket) {
    const userId = (client.handshake.auth as any)?.userId;
    if (!userId) {
      this.logger.warn('⚠️ Connection attempt without userId');
      client.disconnect();
      return;
    }

    this.userConnections.set(client.id, { userId, conversationIds: new Set() });
    this.logger.log(`✅ User connected: ${userId} (socket: ${client.id})`);
  }

  handleDisconnect(client: Socket) {
    const user = this.userConnections.get(client.id);
    if (user) {
      this.logger.log(
        `✅ User disconnected: ${user.userId} (socket: ${client.id})`,
      );
      this.userConnections.delete(client.id);
    }
  }

  @SubscribeMessage('join-conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const user = this.userConnections.get(client.id);
    if (!user) {
      client.emit('error', 'User not authenticated');
      return;
    }

    const { conversationId } = data;
    const room = `conversation:${conversationId}`;

    // Verify user is a participant
    try {
      const messages = await this.rentalChatService.getMessages(
        conversationId,
        user.userId,
      );
      client.join(room);
      user.conversationIds.add(conversationId);

      this.logger.log(
        `✅ User ${user.userId} joined conversation ${conversationId}`,
      );
      client.emit('joined-conversation', {
        conversationId,
        messageCount: messages.length,
      });
      this.server
        .to(room)
        .emit('user-joined', { userId: user.userId, conversationId });
    } catch (error: any) {
      this.logger.error(`❌ Join failed for ${user.userId}:`, error.message);
      client.emit('error', error.message);
    }
  }

  @SubscribeMessage('leave-conversation')
  handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const user = this.userConnections.get(client.id);
    if (!user) return;

    const { conversationId } = data;
    const room = `conversation:${conversationId}`;

    client.leave(room);
    user.conversationIds.delete(conversationId);

    this.logger.log(
      `✅ User ${user.userId} left conversation ${conversationId}`,
    );
    this.server
      .to(room)
      .emit('user-left', { userId: user.userId, conversationId });
  }

  @SubscribeMessage('send-message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { conversationId: string; content: string; visibleTo?: string },
  ) {
    const user = this.userConnections.get(client.id);
    if (!user) {
      client.emit('error', 'User not authenticated');
      return;
    }

    const { conversationId, content, visibleTo } = data;
    const room = `conversation:${conversationId}`;

    try {
      const message = await this.rentalChatService.sendMessage(
        conversationId,
        user.userId,
        content,
        visibleTo as any,
      );

      this.logger.log(`✅ Message sent in ${conversationId} by ${user.userId}`);

      // Broadcast message to everyone in the conversation
      // Frontend will filter based on their role and visibility
      this.server.to(room).emit('new-message', {
        _id: message._id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        content: message.content,
        visibleTo: message.visibleTo,
        createdAt: message.createdAt,
      });

      client.emit('message-sent', { messageId: message._id });
    } catch (error: any) {
      this.logger.error(`❌ Send failed for ${user.userId}:`, error.message);
      client.emit('error', error.message);
    }
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; isTyping: boolean },
  ) {
    const user = this.userConnections.get(client.id);
    if (!user) return;

    const { conversationId, isTyping } = data;
    const room = `conversation:${conversationId}`;

    this.server.to(room).emit('user-typing', {
      userId: user.userId,
      conversationId,
      isTyping,
    });
  }
}
