import { Body, Controller, Get, Param, Post, UseGuards, Request } from '@nestjs/common';
import { RentalChatService } from './rental-chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('rental-chat')
export class RentalChatController {
    constructor(private readonly rentalChatService: RentalChatService) { }

    @Post('rentals/:rentalId/start')
    async startConversation(@Param('rentalId') rentalId: string) {
        const conversation = await this.rentalChatService.getOrCreateConversation(rentalId);
        console.log(`✅ [RentalChatController.startConversation] Conversation created/found:`, conversation._id);
        return {
            conversationId: conversation._id.toString(),
            conversation: {
                _id: conversation._id,
                rentalId: conversation.rentalId,
                participants: conversation.participants,
                lastMessage: conversation.lastMessage,
                createdAt: conversation.createdAt,
                updatedAt: conversation.updatedAt,
            }
        };
    }

    @Get('conversations/:conversationId/messages')
    @UseGuards(JwtAuthGuard)
    async getMessages(
        @Param('conversationId') conversationId: string,
        @Request() req: any,
    ) {
        try {
            const userId = req.user?.id || req.user?._id || req.user?.sub;
            console.log(`🔷 [getMessages] conversationId: ${conversationId}, userId: ${userId}, req.user:`, req.user);

            if (!userId) {
                console.log(`❌ [getMessages] User not authenticated. req.user:`, req.user);
                return { error: 'User not authenticated', code: 401 };
            }

            const messages = await this.rentalChatService.getMessages(conversationId, userId);
            console.log(`✅ [getMessages] Returned ${messages.length} messages for user ${userId}`);
            return { messages };
        } catch (error: any) {
            console.log(`❌ [getMessages] Error: ${error.message}`);
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
            const senderId = req.user?.id || req.user?._id || req.user?.sub;
            console.log(`🔷 [sendMessage] conversationId: ${conversationId}, senderId: ${senderId}, content: ${body.content.substring(0, 50)}`);

            if (!senderId) {
                console.log(`❌ [sendMessage] User not authenticated`);
                return { error: 'User not authenticated', code: 401 };
            }

            const message = await this.rentalChatService.sendMessage(
                conversationId,
                senderId,
                body.content,
                body.visibleTo as any
            );

            console.log(`✅ [sendMessage] Message created:`, message._id);
            return { message };
        } catch (error: any) {
            console.log(`❌ [sendMessage] Error: ${error.message}`);
            return { error: error.message, code: error.status || 400 };
        }
    }
}
