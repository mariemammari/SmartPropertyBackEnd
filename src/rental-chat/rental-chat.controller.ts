import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  Request,
  Query,
  ForbiddenException,
} from '@nestjs/common';
import { RentalChatService } from './rental-chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RentalConversationType } from './schemas/rental-conversation.schema';

@Controller('rental-chat')
export class RentalChatController {
  constructor(private readonly rentalChatService: RentalChatService) {}

  @Post('rentals/:rentalId/start')
  @UseGuards(JwtAuthGuard)
  async startConversation(
    @Param('rentalId') rentalId: string,
    @Request() req: any,
    @Query('conversationType') conversationType?: RentalConversationType,
  ) {
    const userId = req.user.userId;
    const userConversations =
      await this.rentalChatService.getConversationsForRental(rentalId, userId);

    if (conversationType) {
      const conversation = userConversations.find(
        (item) => item.conversationType === conversationType,
      );
      if (!conversation) {
        throw new ForbiddenException(
          'User is not a participant in this conversation type',
        );
      }

      return {
        conversationId: conversation._id.toString(),
        conversation: {
          _id: conversation._id,
          rentalId: conversation.rentalId,
          conversationType: conversation.conversationType,
          participants: conversation.participants,
          lastMessage: conversation.lastMessage,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
        },
      };
    }

    const agentOwner = userConversations.find(
      (item) => item.conversationType === RentalConversationType.AGENT_OWNER,
    );
    const agentTenant = userConversations.find(
      (item) => item.conversationType === RentalConversationType.AGENT_TENANT,
    );

    return {
      rentalId,
      conversations: {
        agentOwner: agentOwner
          ? {
              conversationId: agentOwner._id.toString(),
              conversationType: agentOwner.conversationType,
            }
          : null,
        agentTenant: agentTenant
          ? {
              conversationId: agentTenant._id.toString(),
              conversationType: agentTenant.conversationType,
            }
          : null,
      },
    };
  }

  @Get('rentals/:rentalId/conversations')
  @UseGuards(JwtAuthGuard)
  async getRentalConversations(
    @Param('rentalId') rentalId: string,
    @Request() req: any,
  ) {
    const userId = req.user.userId;
    const conversations =
      await this.rentalChatService.getConversationsForRental(rentalId, userId);
    return {
      rentalId,
      conversations,
    };
  }

  @Get('conversations/:conversationId/messages')
  @UseGuards(JwtAuthGuard)
  async getMessages(
    @Param('conversationId') conversationId: string,
    @Request() req: any,
  ) {
    try {
      const userId = req.user.userId;
      if (!userId) {
        return { error: 'User not authenticated', code: 401 };
      }

      const messages = await this.rentalChatService.getMessages(
        conversationId,
        userId,
      );
      return { messages };
    } catch (error: any) {
      return { error: error.message, code: error.status || 400 };
    }
  }

  @Post('conversations/:conversationId/messages')
  @UseGuards(JwtAuthGuard)
  async sendMessage(
    @Param('conversationId') conversationId: string,
    @Body() body: { content: string; visibleTo?: string },
    @Request() req: any,
  ) {
    try {
      const senderId = req.user.userId;

      if (!senderId) {
        return { error: 'User not authenticated', code: 401 };
      }

      const message = await this.rentalChatService.sendMessage(
        conversationId,
        senderId,
        body.content,
        body.visibleTo as any,
      );

      return { message };
    } catch (error: any) {
      return { error: error.message, code: error.status || 400 };
    }
  }
}
