import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

describe('NotificationsController', () => {
    let controller: NotificationsController;

    const notificationsServiceMock = {
        create: jest.fn(),
        findByUserId: jest.fn(),
        getUnreadCount: jest.fn(),
        markAsRead: jest.fn(),
        markAllAsRead: jest.fn(),
    };

    beforeEach(async () => {
        jest.clearAllMocks();
        const module: TestingModule = await Test.createTestingModule({
            controllers: [NotificationsController],
            providers: [
                {
                    provide: NotificationsService,
                    useValue: notificationsServiceMock,
                },
            ],
        }).compile();

        controller = module.get<NotificationsController>(NotificationsController);
    });

    it('create delegates to service', async () => {
        const dto: any = { recipientId: 'u1', title: 't' };
        notificationsServiceMock.create.mockResolvedValueOnce({});

        await controller.create(dto);

        expect(notificationsServiceMock.create).toHaveBeenCalledWith(dto);
    });

    it('getUnreadCount delegates to service', async () => {
        notificationsServiceMock.getUnreadCount.mockResolvedValueOnce(3);

        await controller.getUnreadCount('u1');

        expect(notificationsServiceMock.getUnreadCount).toHaveBeenCalledWith('u1');
    });

    it('markAllAsRead delegates to service', async () => {
        notificationsServiceMock.markAllAsRead.mockResolvedValueOnce({});

        await controller.markAllAsRead('u2');

        expect(notificationsServiceMock.markAllAsRead).toHaveBeenCalledWith('u2');
    });
});
