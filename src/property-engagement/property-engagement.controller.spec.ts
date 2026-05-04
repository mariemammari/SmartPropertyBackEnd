import { Test, TestingModule } from '@nestjs/testing';
import { PropertyEngagementController } from './property-engagement.controller';
import { PropertyEngagementService } from './property-engagement.service';

describe('PropertyEngagementController', () => {
  let controller: PropertyEngagementController;

  const serviceMock = {
    trackEvent: jest.fn(),
    getSummaryForScope: jest.fn(),
    getPropertySummary: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PropertyEngagementController],
      providers: [
        {
          provide: PropertyEngagementService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<PropertyEngagementController>(
      PropertyEngagementController,
    );
  });

  it('trackEvent forwards user and payload', async () => {
    serviceMock.trackEvent.mockResolvedValueOnce({});

    await controller.trackEvent(
      { user: { userId: 'u1' } } as any,
      { eventType: 'VIEW' },
    );

    expect(serviceMock.trackEvent).toHaveBeenCalledWith(
      { userId: 'u1' },
      { eventType: 'VIEW' },
    );
  });

  it('getAgentSummary delegates to service', async () => {
    serviceMock.getSummaryForScope.mockResolvedValueOnce({});

    await controller.getAgentSummary({ user: { userId: 'u1' } } as any);

    expect(serviceMock.getSummaryForScope).toHaveBeenCalledWith(
      'agent',
      { userId: 'u1' },
    );
  });
});
