import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { PropertyService } from './property.service';
import { Property } from './schemas/property.schema';
import { PropertyListing } from '../property-listing/schemas/property-listing.schema';
import { User } from '../user/schemas/user.schema';
import { RentalService } from '../rental/rental.service';
import { PropertyMediaService } from '../Property-Media/property-media.service';

describe('PropertyService', () => {
  let service: PropertyService;

  const createExecChain = () => ({
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    exec: jest.fn(),
  });

  const propertyModelMock = Object.assign(
    jest.fn().mockImplementation((data: unknown) => ({
      save: jest.fn().mockResolvedValue(data),
    })),
    {
      countDocuments: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
    },
  );

  const listingModelMock = {
    deleteMany: jest.fn(),
  };
  const userModelMock = {};
  const rentalServiceMock = {
    createFromPropertyStatusChange: jest.fn(),
    terminateActiveRentalsForProperty: jest.fn(),
  };
  const propertyMediaServiceMock = {
    removeAllByProperty: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PropertyService,
        {
          provide: getModelToken(Property.name),
          useValue: propertyModelMock,
        },
        {
          provide: getModelToken(PropertyListing.name),
          useValue: listingModelMock,
        },
        {
          provide: getModelToken(User.name),
          useValue: userModelMock,
        },
        {
          provide: RentalService,
          useValue: rentalServiceMock,
        },
        {
          provide: PropertyMediaService,
          useValue: propertyMediaServiceMock,
        },
      ],
    }).compile();

    service = module.get<PropertyService>(PropertyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('create: should build geo location when lat/lng are valid (including 0)', async () => {
    const dto = {
      ownerId: new Types.ObjectId().toString(),
      createdBy: new Types.ObjectId().toString(),
      lat: 0,
      lng: 0,
      price: 1200,
      type: 'rent',
      propertyType: 'apartment',
    } as any;

    await service.create(dto);

    expect(propertyModelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: expect.any(Types.ObjectId),
        createdBy: expect.any(Types.ObjectId),
        location: { type: 'Point', coordinates: [0, 0] },
      }),
    );
  });

  it('create: should omit location when coordinates are missing', async () => {
    const dto = {
      ownerId: new Types.ObjectId().toString(),
      createdBy: new Types.ObjectId().toString(),
      price: 1200,
      type: 'rent',
      propertyType: 'apartment',
    } as any;

    await service.create(dto);

    const createdArg = propertyModelMock.mock.calls[0][0];
    expect(createdArg.location).toBeUndefined();
  });

  it('findAll: should apply filters and return paginated payload', async () => {
    const chain = createExecChain();
    chain.exec.mockResolvedValueOnce([{ _id: 'p1' }]);

    propertyModelMock.countDocuments.mockResolvedValueOnce(10);
    propertyModelMock.find.mockReturnValueOnce(chain);

    const ownerId = new Types.ObjectId().toString();

    const result = await service.findAll({
      page: 2,
      limit: 5,
      city: 'Tunis',
      minPrice: 1000,
      maxPrice: 3000,
      hasParking: true,
      ownerId,
    } as any);

    expect(propertyModelMock.countDocuments).toHaveBeenCalledWith(
      expect.objectContaining({
        city: { $regex: 'Tunis', $options: 'i' },
        price: { $gte: 1000, $lte: 3000 },
        hasParking: true,
        ownerId: expect.any(Types.ObjectId),
      }),
    );

    expect(chain.skip).toHaveBeenCalledWith(5);
    expect(chain.limit).toHaveBeenCalledWith(5);
    expect(result).toEqual({
      data: [{ _id: 'p1' }],
      total: 10,
      page: 2,
      pages: 2,
    });
  });

  it('findOne: should throw when property does not exist', async () => {
    const chain = {
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValueOnce(null),
    };
    propertyModelMock.findById.mockReturnValueOnce(chain);

    await expect(service.findOne('missing-id')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('update: should unset location when only one coordinate is provided', async () => {
    propertyModelMock.findById.mockReturnValueOnce({
      exec: jest.fn().mockResolvedValueOnce({ _id: 'p1' }),
    });
    const updated = { _id: 'p1' };
    const chain = { exec: jest.fn().mockResolvedValueOnce(updated) };
    propertyModelMock.findByIdAndUpdate.mockReturnValueOnce(chain);

    const result = await service.update('p1', { lat: 36.8 } as any);

    expect(propertyModelMock.findByIdAndUpdate).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({
        $unset: expect.objectContaining({ location: '' }),
      }),
      { new: true },
    );
    expect(result).toEqual(updated);
  });

  it('remove: should throw when property does not exist', async () => {
    listingModelMock.deleteMany.mockResolvedValueOnce({ deletedCount: 0 });
    propertyModelMock.findByIdAndDelete.mockReturnValueOnce({
      exec: jest.fn().mockResolvedValueOnce(null),
    });

    await expect(
      service.remove(new Types.ObjectId().toString()),
    ).rejects.toThrow(
      NotFoundException,
    );
  });

  it('getStats: should aggregate all counters', async () => {
    propertyModelMock.countDocuments
      .mockResolvedValueOnce(20)
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(4);

    const result = await service.getStats();

    expect(result).toEqual({
      total: 20,
      forRent: 8,
      forSale: 12,
      available: 10,
      rented: 6,
      sold: 4,
    });
  });
});
