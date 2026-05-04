import { Test, TestingModule } from '@nestjs/testing';
import { PropertyController } from './property.controller';
import { PropertyService } from './property.service';
import { UserRole } from '../user/schemas/user.schema';
import { NearbyService } from '../nearby/nearby.service';

describe('PropertyController', () => {
  let controller: PropertyController;

  const propertyServiceMock = {
    create: jest.fn(),
    findAll: jest.fn(),
    getStats: jest.fn(),
    findByAgent: jest.fn(),
    findByOwner: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
  const nearbyServiceMock = {
    getNearby: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PropertyController],
      providers: [
        {
          provide: PropertyService,
          useValue: propertyServiceMock,
        },
        {
          provide: NearbyService,
          useValue: nearbyServiceMock,
        },
      ],
    }).compile();

    controller = module.get<PropertyController>(PropertyController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create: should set createdBy for real estate agent', async () => {
    const dto: any = { ownerId: 'owner-1' };
    const req = {
      user: { userId: 'agent-1', role: UserRole.REAL_ESTATE_AGENT },
    } as any;

    await controller.create(dto, req);

    expect(propertyServiceMock.create).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: 'owner-1', createdBy: 'agent-1' }),
    );
  });

  it('create: should enforce ownerId for client and remove createdBy', async () => {
    const dto: any = { ownerId: 'other-owner', createdBy: 'agent-1' };
    const req = { user: { userId: 'client-1', role: UserRole.CLIENT } } as any;

    await controller.create(dto, req);

    expect(propertyServiceMock.create).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: 'client-1', createdBy: undefined }),
    );
  });

  it('findAll: should force createdBy filter for agent', async () => {
    const filters: any = { page: 1 };
    const req = {
      user: { userId: 'agent-9', role: UserRole.REAL_ESTATE_AGENT },
    } as any;

    await controller.findAll(filters, req);

    expect(propertyServiceMock.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, createdBy: 'agent-9' }),
    );
  });

  it('findMine: should route to findByAgent for agent', async () => {
    const req = {
      user: { userId: 'agent-2', role: UserRole.REAL_ESTATE_AGENT },
    } as any;

    await controller.findMine(req);

    expect(propertyServiceMock.findByAgent).toHaveBeenCalledWith('agent-2');
    expect(propertyServiceMock.findByOwner).not.toHaveBeenCalled();
  });

  it('findMine: should route to findByOwner for non-agent', async () => {
    const req = { user: { userId: 'owner-2', role: UserRole.CLIENT } } as any;

    await controller.findMine(req);

    expect(propertyServiceMock.findByOwner).toHaveBeenCalledWith('owner-2');
    expect(propertyServiceMock.findByAgent).not.toHaveBeenCalled();
  });

  it('remove: should call service remove with id', async () => {
    await controller.remove('property-1');
    expect(propertyServiceMock.remove).toHaveBeenCalledWith('property-1');
  });
});
