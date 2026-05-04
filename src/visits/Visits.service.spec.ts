import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { VisitsService } from './Visits.service';
import { Visit } from './schema/visit.schema';

describe('VisitsService', () => {
  let service: VisitsService;

  const visitModelMock = Object.assign(
    jest.fn().mockImplementation((data: unknown) => ({
      save: jest.fn().mockResolvedValue(data),
    })),
    {
      find: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
      countDocuments: jest.fn(),
    },
  );

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VisitsService,
        {
          provide: getModelToken(Visit.name),
          useValue: visitModelMock,
        },
      ],
    }).compile();

    service = module.get<VisitsService>(VisitsService);
  });

  it('create maps ids and dates', async () => {
    const dto: any = {
      propertyId: new Types.ObjectId().toString(),
      agentId: new Types.ObjectId().toString(),
      requestedSlots: [new Date().toISOString()],
      confirmedSlot: new Date().toISOString(),
    };

    await service.create(dto);

    expect(visitModelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        propertyId: expect.any(Types.ObjectId),
        agentId: expect.any(Types.ObjectId),
        requestedSlots: [expect.any(Date)],
        confirmedSlot: expect.any(Date),
      }),
    );
  });

  it('findOne throws when visit missing', async () => {
    visitModelMock.findById.mockReturnValueOnce({
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValueOnce(null),
    });

    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });
});
