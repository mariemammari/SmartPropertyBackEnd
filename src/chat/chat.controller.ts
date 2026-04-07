import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations')
  async getConversations(@Request() req) {
    const userId = req.user.userId || req.user._id || req.user.sub;
    return this.chatService.getUserConversations(userId);
  }

  @Post('conversations/start/:peerId')
  async startConversation(@Request() req, @Param('peerId') peerId: string) {
    const userId = req.user.userId || req.user._id || req.user.sub;
    return this.chatService.getOrCreateConversation(userId, peerId);
  }

  @Get('conversations/:id/messages')
  async getMessages(@Param('id') conversationId: string) {
    return this.chatService.getMessages(conversationId);
  }

  @Get('unread-count')
  async getUnreadCount(@Request() req) {
    const userId = req.user.userId || req.user._id || req.user.sub;
    const count = await this.chatService.getUnreadCount(userId);
    return { count };
  }

  @Post('mark-read/:conversationId')
  async markAsRead(
    @Request() req,
    @Param('conversationId') conversationId: string,
  ) {
    const userId = req.user.userId || req.user._id || req.user.sub;
    await this.chatService.markAsRead(conversationId, userId);
    return { success: true };
  }
}
