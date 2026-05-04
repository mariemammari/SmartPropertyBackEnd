import { Test, TestingModule } from '@nestjs/testing';
import { PropertyListingController } from './property-listing.controller';
import { PropertyListingService } from './property-listing.service';

describe('PropertyListingController', () => {
  let controller: PropertyListingController;

  const listingServiceMock = {
    create: jest.fn(),
    findAll: jest.fn(),
    getStats: jest.fn(),
    findByProperty: jest.fn(),
    findByBranch: jest.fn(),
    findActiveListing: jest.fn(),
    findReferenceByPropertyId: jest.fn(),
    getAgentByPropertyId: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    submitForReview: jest.fn(),
    archive: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PropertyListingController],
      providers: [
        {
          provide: PropertyListingService,
          useValue: listingServiceMock,
        },
      ],
    }).compile();

    controller = module.get<PropertyListingController>(PropertyListingController);
  });

  it('create calls service', async () => {
    const dto: any = { propertyId: 'p1' };
    listingServiceMock.create.mockResolvedValueOnce({});

    await controller.create(dto);

    expect(listingServiceMock.create).toHaveBeenCalledWith(dto);
  });

  it('findAll calls service with filters', async () => {
    const filters: any = { page: 1 };
    listingServiceMock.findAll.mockResolvedValueOnce({});

    await controller.findAll(filters);

    expect(listingServiceMock.findAll).toHaveBeenCalledWith(filters);
  });

  it('remove calls service', async () => {
    await controller.remove('id-1');

    expect(listingServiceMock.remove).toHaveBeenCalledWith('id-1');
  });
});
