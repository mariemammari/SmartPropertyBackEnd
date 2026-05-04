import { Test, TestingModule } from '@nestjs/testing';
import { VisitsController } from './Visits.controller';
import { VisitsService } from './Visits.service';

describe('VisitsController', () => {
    let controller: VisitsController;

    const visitsServiceMock = {
        create: jest.fn(),
        findAll: jest.fn(),
        getStats: jest.fn(),
        findUrgent: jest.fn(),
        findToday: jest.fn(),
        findByProperty: jest.fn(),
        findOne: jest.fn(),
        update: jest.fn(),
        remove: jest.fn(),
    };

    beforeEach(async () => {
        jest.clearAllMocks();
        const module: TestingModule = await Test.createTestingModule({
            controllers: [VisitsController],
            providers: [
                {
                    provide: VisitsService,
                    useValue: visitsServiceMock,
                },
            ],
        }).compile();

        controller = module.get<VisitsController>(VisitsController);
    });

    it('create delegates to service', async () => {
        const dto: any = { propertyId: 'p1' };
        visitsServiceMock.create.mockResolvedValueOnce({});

        await controller.create(dto);

        expect(visitsServiceMock.create).toHaveBeenCalledWith(dto);
    });

    it('getStats delegates to service', async () => {
        visitsServiceMock.getStats.mockResolvedValueOnce({});

        await controller.getStats();

        expect(visitsServiceMock.getStats).toHaveBeenCalled();
    });
});
