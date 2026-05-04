import { ChatService } from './chat.service';

describe('ChatService', () => {
    let service: ChatService;

    const conversationModelMock = {
        find: jest.fn(),
    };

    const messageModelMock = {
        countDocuments: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        service = new ChatService(
            conversationModelMock as any,
            messageModelMock as any,
        );
    });

    it('getUnreadCount aggregates across conversations', async () => {
        conversationModelMock.find.mockReturnValueOnce({
            select: jest.fn().mockReturnThis(),
            exec: jest.fn().mockResolvedValue([{ _id: 'c1' }, { _id: 'c2' }]),
        });
        messageModelMock.countDocuments.mockResolvedValueOnce(3);

        const count = await service.getUnreadCount('u1');

        expect(messageModelMock.countDocuments).toHaveBeenCalledWith(
            expect.objectContaining({
                conversationId: { $in: ['c1', 'c2'] },
                sender: { $ne: 'u1' },
                read: false,
            }),
        );
        expect(count).toBe(3);
    });
});
