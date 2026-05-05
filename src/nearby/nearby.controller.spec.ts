import { Test, TestingModule } from '@nestjs/testing';
import { NearbyController } from './nearby.controller';
import { NearbyService } from './nearby.service';

describe('NearbyController', () => {
    let controller: NearbyController;

    const nearbyServiceMock = {
        getNearby: jest.fn(),
    };

    beforeEach(async () => {
        jest.clearAllMocks();
        const module: TestingModule = await Test.createTestingModule({
            controllers: [NearbyController],
            providers: [
                {
                    provide: NearbyService,
                    useValue: nearbyServiceMock,
                },
            ],
        }).compile();

        controller = module.get<NearbyController>(NearbyController);
    });

    it('getNearby calls service with query params', async () => {
        nearbyServiceMock.getNearby.mockResolvedValueOnce({});

        await controller.getNearby({ lat: 1, lng: 2, radius: 3 } as any);

        expect(nearbyServiceMock.getNearby).toHaveBeenCalledWith(1, 2, 3);
    });
});
