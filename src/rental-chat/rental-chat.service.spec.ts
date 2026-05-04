import { NotFoundException } from '@nestjs/common';
import { RentalChatService } from './rental-chat.service';

describe('RentalChatService', () => {
  let service: RentalChatService;

  const rentalModelMock = {
    findById: jest.fn(),
  };

  const conversationModelMock = {
    findById: jest.fn(),
  };

  const messageModelMock = {
    find: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RentalChatService(
      rentalModelMock as any,
      conversationModelMock as any,
      messageModelMock as any,
    );
  });

  it('getMessages throws when conversation is missing', async () => {
    conversationModelMock.findById.mockReturnValueOnce({
      exec: jest.fn().mockResolvedValueOnce(null),
    });

    await expect(service.getMessages('c1', 'u1')).rejects.toThrow(
      NotFoundException,
    );
  });
});
