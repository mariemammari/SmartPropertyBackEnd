import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { PropertyListingService } from './property-listing.service';
import { PropertyListing, ListingStatus } from './schemas/property-listing.schema';
import { RentalService } from '../rental/rental.service';

describe('PropertyListingService', () => {
  let service: PropertyListingService;

  const createExecChain = () => ({
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    exec: jest.fn(),
  });

  const listingModelMock = Object.assign(
    jest.fn().mockImplementation((data: unknown) => ({
      save: jest.fn().mockResolvedValue(data),
    })),
    {
      countDocuments: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
      findOne: jest.fn(),
    },
  );

  const rentalServiceMock = {
    createFromListingStatusChange: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PropertyListingService,
        {
          provide: getModelToken(PropertyListing.name),
          useValue: listingModelMock,
        },
        {
          provide: RentalService,
          useValue: rentalServiceMock,
        },
      ],
    }).compile();

    service = module.get<PropertyListingService>(PropertyListingService);
  });

  it('create builds object ids and defaults status', async () => {
    const dto: any = {
      propertyId: new Types.ObjectId().toString(),
      ownerId: new Types.ObjectId().toString(),
      createdBy: new Types.ObjectId().toString(),
    };

    await service.create(dto);

    expect(listingModelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        propertyId: expect.any(Types.ObjectId),
        ownerId: expect.any(Types.ObjectId),
        createdBy: expect.any(Types.ObjectId),
        status: ListingStatus.DRAFT,
      }),
    );
  });

  it('findAll returns paginated payload', async () => {
    const chain = createExecChain();
    chain.exec.mockResolvedValueOnce([{ _id: 'l1' }]);
    listingModelMock.countDocuments.mockResolvedValueOnce(10);
    listingModelMock.find.mockReturnValueOnce(chain);

    const ownerId = new Types.ObjectId().toString();
    const result = await service.findAll({
      page: 2,
      limit: 5,
      ownerId,
      status: ListingStatus.ACTIVE,
    } as any);

    expect(listingModelMock.countDocuments).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: expect.any(Types.ObjectId),
        status: ListingStatus.ACTIVE,
      }),
    );
    expect(chain.skip).toHaveBeenCalledWith(5);
    expect(chain.limit).toHaveBeenCalledWith(5);
    expect(result).toEqual({
      data: [{ _id: 'l1' }],
      total: 10,
      page: 2,
      pages: 2,
    });
  });

  it('findOne throws when listing is missing', async () => {
    const chain = createExecChain();
    chain.exec.mockResolvedValueOnce(null);
    listingModelMock.findById.mockReturnValueOnce(chain);

    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('update triggers rental creation when status becomes RENTED', async () => {
    const existing = { _id: new Types.ObjectId(), status: ListingStatus.DRAFT };
    listingModelMock.findById.mockReturnValueOnce({
      exec: jest.fn().mockResolvedValueOnce(existing),
    });

    const updated = {
      _id: new Types.ObjectId(),
      propertyId: new Types.ObjectId(),
      status: ListingStatus.RENTED,
    };
    listingModelMock.findByIdAndUpdate.mockReturnValueOnce({
      exec: jest.fn().mockResolvedValueOnce(updated),
    });

    await service.update('l1', {
      status: ListingStatus.RENTED,
      tenantId: 't1',
      durationMonths: 12,
      paymentFrequencyMonths: 1,
      autoRenew: true,
      noticePeriodDays: 30,
      contractSignedAt: new Date(),
      moveInDate: new Date(),
      moveOutDate: new Date(),
      notes: 'note',
    } as any);

    expect(rentalServiceMock.createFromListingStatusChange).toHaveBeenCalled();
  });

  it('remove throws when listing not found', async () => {
    listingModelMock.findByIdAndDelete.mockReturnValueOnce({
      exec: jest.fn().mockResolvedValueOnce(null),
    });

    await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
  });
});
