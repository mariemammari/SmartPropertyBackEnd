import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ComplaintController, UserRole } from './complaint.controller';
import { ComplaintService } from '../services/complaint.service';

describe('ComplaintController', () => {
  let controller: ComplaintController;

  const complaintServiceMock = {
    create: jest.fn(),
    findAll: jest.fn(),
    findByClient: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    addAdminResponse: jest.fn(),
    resolve: jest.fn(),
    addClientFeedback: jest.fn(),
    markAsRead: jest.fn(),
    delete: jest.fn(),
    getStatistics: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ComplaintController],
      providers: [
        {
          provide: ComplaintService,
          useValue: complaintServiceMock,
        },
      ],
    }).compile();

    controller = module.get<ComplaintController>(ComplaintController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create: should pass userId to service', async () => {
    const dto: any = { subject: 'Issue', description: 'Detailed description', target: 'other' };
    const req = { user: { userId: 'user-1' } } as any;

    await controller.create(dto, req);

    expect(complaintServiceMock.create).toHaveBeenCalledWith(dto, 'user-1');
  });

  it('findAll: should block branch manager without branch', async () => {
    const req = { user: { role: UserRole.BRANCH_MANAGER } } as any;

    await expect(
      controller.findAll(req, undefined, undefined, undefined, '1', '20'),
    ).rejects.toThrow(ForbiddenException);

    expect(complaintServiceMock.findAll).not.toHaveBeenCalled();
  });

  it('findAll: should scope branch manager to branchId', async () => {
    complaintServiceMock.findAll.mockResolvedValueOnce({
      complaints: [],
      pagination: { page: 1, limit: 20, total: 0, pages: 0 },
    });

    const req = {
      user: { role: UserRole.BRANCH_MANAGER, branchId: 'branch-1' },
    } as any;

    await controller.findAll(req, undefined, undefined, undefined, '1', '20');

    expect(complaintServiceMock.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: 'branch-1' }),
    );
  });

  it('getById: should block clients from viewing others complaints', async () => {
    complaintServiceMock.findById.mockResolvedValueOnce({
      userId: 'owner-1',
      branchId: 'branch-1',
    });

    const req = { user: { role: UserRole.CLIENT, userId: 'client-1' } } as any;

    await expect(controller.getById('c1', req)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('addAdminResponse: should enforce branch ownership for managers', async () => {
    complaintServiceMock.findById.mockResolvedValueOnce({
      branchId: 'branch-2',
    });

    const req = {
      user: { role: UserRole.BRANCH_MANAGER, branchId: 'branch-1', userId: 'u1' },
    } as any;

    await expect(
      controller.addAdminResponse('c1', { adminNote: 'Note' } as any, req),
    ).rejects.toThrow(ForbiddenException);

    expect(complaintServiceMock.addAdminResponse).not.toHaveBeenCalled();
  });

  it('getStatistics: should scope branch manager stats', async () => {
    complaintServiceMock.getStatistics.mockResolvedValueOnce({ total: 0 });

    const req = {
      user: { role: UserRole.BRANCH_MANAGER, branchId: 'branch-1' },
    } as any;

    await controller.getStatistics(req);

    expect(complaintServiceMock.getStatistics).toHaveBeenCalledWith('branch-1');
  });
});
