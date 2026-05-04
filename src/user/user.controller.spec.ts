import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersController } from './user.controller';
import { UserService } from './user.service';

describe('UsersController', () => {
    let controller: UsersController;

    const userServiceMock = {
        create: jest.fn(),
        findById: jest.fn(),
        updateUser: jest.fn(),
        deleteUser: jest.fn(),
        findManagerBranch: jest.fn(),
        findAllStaff: jest.fn(),
        findUsersByBranch: jest.fn(),
        findAllClients: jest.fn(),
        changePassword: jest.fn(),
        updatePhotoUrl: jest.fn(),
        updateSignatureUrl: jest.fn(),
        uploadPhoto: jest.fn(),
        uploadSignature: jest.fn(),
    };

    beforeEach(async () => {
        jest.clearAllMocks();
        const module: TestingModule = await Test.createTestingModule({
            controllers: [UsersController],
            providers: [
                {
                    provide: UserService,
                    useValue: userServiceMock,
                },
            ],
        }).compile();

        controller = module.get<UsersController>(UsersController);
    });

    it('create returns sanitized user', async () => {
        userServiceMock.create.mockResolvedValueOnce({
            toObject: () => ({ password: 'secret', email: 'u@test.com' }),
        });

        const result = await controller.create({} as any);

        expect(result.user.password).toBeUndefined();
        expect(result.user.email).toBe('u@test.com');
    });

    it('getProfile throws NotFound when user missing', async () => {
        userServiceMock.findById.mockResolvedValueOnce(null);

        await expect(
            controller.getProfile({ user: { userId: 'u1' } } as any),
        ).rejects.toThrow(NotFoundException);
    });

    it('savePhotoUrl rejects missing photoUrl', async () => {
        await expect(
            controller.savePhotoUrl({ user: { userId: 'u1' } } as any, {} as any),
        ).rejects.toThrow(BadRequestException);
    });
});
