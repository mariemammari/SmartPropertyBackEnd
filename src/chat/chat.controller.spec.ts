import { Test, TestingModule } from '@nestjs/testing';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

describe('ChatController', () => {
  let controller: ChatController;

  const chatServiceMock = {
    getUserConversations: jest.fn(),
    getOrCreateConversation: jest.fn(),
    getMessages: jest.fn(),
    getUnreadCount: jest.fn(),
    markAsRead: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        {
          provide: ChatService,
          useValue: chatServiceMock,
        },
      ],
    }).compile();

    controller = module.get<ChatController>(ChatController);
  });

  it('getUnreadCount returns count', async () => {
    chatServiceMock.getUnreadCount.mockResolvedValueOnce(5);

    const result = await controller.getUnreadCount({
      user: { userId: 'u1' },
    } as any);

    expect(result).toEqual({ count: 5 });
  });

  it('startConversation delegates to service', async () => {
    chatServiceMock.getOrCreateConversation.mockResolvedValueOnce({});

    await controller.startConversation(
      { user: { userId: 'u1' } } as any,
      'peer-1',
    );

    expect(chatServiceMock.getOrCreateConversation).toHaveBeenCalledWith(
      'u1',
      'peer-1',
    );
  });
});
