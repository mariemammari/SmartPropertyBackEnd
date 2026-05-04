import { Test, TestingModule } from '@nestjs/testing';
import { RentalChatController } from './rental-chat.controller';
import { RentalChatService } from './rental-chat.service';
import { RentalConversationType } from './schemas/rental-conversation.schema';

describe('RentalChatController', () => {
    let controller: RentalChatController;

    const rentalChatServiceMock = {
        getConversationsForRental: jest.fn(),
        getMessages: jest.fn(),
        sendMessage: jest.fn(),
    };

    beforeEach(async () => {
        jest.clearAllMocks();
        const module: TestingModule = await Test.createTestingModule({
            controllers: [RentalChatController],
            providers: [
                {
                    provide: RentalChatService,
                    useValue: rentalChatServiceMock,
                },
            ],
        }).compile();

        controller = module.get<RentalChatController>(RentalChatController);
    });

    it('startConversation returns conversation when type is provided', async () => {
        rentalChatServiceMock.getConversationsForRental.mockResolvedValueOnce([
            {
                _id: { toString: () => 'c1' },
                rentalId: 'r1',
                conversationType: RentalConversationType.AGENT_OWNER,
                participants: [],
            },
        ]);

        const result = await controller.startConversation(
            'r1',
            { user: { userId: 'u1' } } as any,
            RentalConversationType.AGENT_OWNER,
        );

        expect(result.conversationId).toBe('c1');
    });

    it('getMessages wraps service errors', async () => {
        const error: any = new Error('Conversation not found');
        error.status = 404;
        rentalChatServiceMock.getMessages.mockRejectedValueOnce(error);

        const result = await controller.getMessages(
            'c1',
            { user: { userId: 'u1' } } as any,
        );

        expect(result).toEqual({ error: 'Conversation not found', code: 404 });
    });
});
