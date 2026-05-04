import { BadRequestException } from '@nestjs/common';
import { PropertyEngagementService } from './property-engagement.service';

describe('PropertyEngagementService', () => {
    let service: PropertyEngagementService;

    const eventModelMock = {};
    const propertyModelMock = {};
    const userModelMock = {};
    const notificationsServiceMock = {
        createMilestoneIfMissing: jest.fn(),
    };

    beforeEach(() => {
        service = new PropertyEngagementService(
            eventModelMock as any,
            propertyModelMock as any,
            userModelMock as any,
            notificationsServiceMock as any,
        );
    });

    it('trackEvent rejects invalid propertyId', async () => {
        await expect(
            service.trackEvent(
                { userId: 'u1', role: 'client' },
                { propertyId: 'bad', eventType: 'VIEW' },
            ),
        ).rejects.toThrow(BadRequestException);
    });
});
