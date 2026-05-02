import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ComplaintService } from './complaint.service';
import { Complaint, ComplaintStatus } from '../schemas/complaint.schema';

describe('ComplaintService', () => {
  let service: ComplaintService;

  const createExecChain = () => ({
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    exec: jest.fn(),
  });

  const complaintModelMock = Object.assign(
    jest.fn().mockImplementation((data: Record<string, unknown>) => ({
      ...data,
      save: jest.fn().mockResolvedValue(data),
    })),
    {
      find: jest.fn(),
      findById: jest.fn(),
      findByIdAndDelete: jest.fn(),
      countDocuments: jest.fn(),
      aggregate: jest.fn(),
    },
  );

  const branchModelMock = {
    findById: jest.fn(),
  };

  const userModelMock = {};

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComplaintService,
        {
          provide: getModelToken(Complaint.name),
          useValue: complaintModelMock,
        },
        {
          provide: getModelToken('Branch'),
          useValue: branchModelMock,
        },
        {
          provide: getModelToken('User'),
          useValue: userModelMock,
        },
      ],
    }).compile();

    service = module.get<ComplaintService>(ComplaintService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('create: should reject when branch does not exist', async () => {
    branchModelMock.findById.mockResolvedValueOnce(null);

    const dto: any = {
      subject: 'Broken sink in unit',
      description: 'The sink is leaking and needs urgent repair.',
      target: 'agent',
      branchId: new Types.ObjectId().toString(),
    };

    await expect(
      service.create(dto, new Types.ObjectId().toString()),
    ).rejects.toThrow(BadRequestException);
  });

  it('create: should set userId, branchId, and open status', async () => {
    const branchId = new Types.ObjectId().toString();
    branchModelMock.findById.mockResolvedValueOnce({ _id: branchId });

    const dto: any = {
      subject: 'Noise issue',
      description: 'There is ongoing noise from the neighbor unit at night.',
      target: 'agent',
      branchId,
    };

    await service.create(dto, new Types.ObjectId().toString());

    expect(complaintModelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: expect.any(Types.ObjectId),
        branchId: expect.any(Types.ObjectId),
        status: ComplaintStatus.OPEN,
      }),
    );
  });

  it('findAll: should apply branch filter and pagination', async () => {
    const chain = createExecChain();
    chain.exec.mockResolvedValueOnce([{ _id: 'c1' }]);

    complaintModelMock.find.mockReturnValueOnce(chain);
    complaintModelMock.countDocuments.mockResolvedValueOnce(10);

    const branchId = new Types.ObjectId().toString();

    const result = await service.findAll({
      status: ComplaintStatus.OPEN,
      target: 'property',
      priority: 'high',
      branchId,
      page: 2,
      limit: 5,
    });

    expect(complaintModelMock.find).toHaveBeenCalledWith(
      expect.objectContaining({
        status: ComplaintStatus.OPEN,
        target: 'property',
        priority: 'high',
        branchId: expect.any(Types.ObjectId),
      }),
    );
    expect(chain.skip).toHaveBeenCalledWith(5);
    expect(chain.limit).toHaveBeenCalledWith(5);
    expect(result).toEqual({
      complaints: [{ _id: 'c1' }],
      pagination: {
        page: 2,
        limit: 5,
        total: 10,
        pages: 2,
      },
    });
  });

  it('update: should block non-owner updates', async () => {
    const complaint: any = {
      userId: new Types.ObjectId(),
      status: ComplaintStatus.OPEN,
    };
    jest.spyOn(service, 'findById').mockResolvedValueOnce(complaint);

    await expect(
      service.update('c1', { subject: 'New subject' } as any, 'other-user'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('addAdminResponse: should default assignedTo to adminId', async () => {
    const complaint: any = {
      save: jest.fn().mockResolvedValueOnce({}),
    };
    jest.spyOn(service, 'findById').mockResolvedValueOnce(complaint);

    const adminId = new Types.ObjectId().toString();

    await service.addAdminResponse('c1', { adminNote: 'Reviewed' } as any, adminId);

    expect(complaint.adminNote).toBe('Reviewed');
    expect(complaint.assignedTo.toString()).toBe(adminId);
  });

  it('getStatistics: should aggregate totals', async () => {
    complaintModelMock.aggregate
      .mockResolvedValueOnce([{ _id: ComplaintStatus.OPEN, count: 3 }])
      .mockResolvedValueOnce([{ _id: 'property', count: 2 }]);
    complaintModelMock.countDocuments.mockResolvedValueOnce(5);

    const result = await service.getStatistics();

    expect(result).toEqual({
      total: 5,
      byStatus: { open: 3 },
      byTarget: { property: 2 },
    });
  });
});
