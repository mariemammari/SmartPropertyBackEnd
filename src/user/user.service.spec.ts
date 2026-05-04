import { BadRequestException, ConflictException } from '@nestjs/common';
import { UserService } from './user.service';
import { UserRole } from './schemas/user.schema';

describe('UserService', () => {
  let service: UserService;

  const userModelMock = {
    findOne: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UserService(userModelMock as any);
  });

  it('create throws ConflictException when email exists', async () => {
    userModelMock.findOne.mockResolvedValueOnce({ _id: 'u1' });

    await expect(
      service.create({
        email: 'user@example.com',
        password: 'pass',
        fullName: 'User One',
        phone: '123',
      } as any),
    ).rejects.toThrow(ConflictException);
  });

  it('updateUser rejects branch manager without branchId', async () => {
    userModelMock.findById.mockReturnValueOnce({
      exec: jest.fn().mockResolvedValueOnce({ role: UserRole.CLIENT }),
    });

    await expect(
      service.updateUser('u1', { role: UserRole.BRANCH_MANAGER } as any),
    ).rejects.toThrow(BadRequestException);
  });
});
