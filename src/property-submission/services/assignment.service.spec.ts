import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { AssignmentService } from '../services/assignment.service';
import { PropertyListing } from '../../property-listing/schemas/property-listing.schema';
import { User, UserRole, UserStatus } from '../../user/schemas/user.schema';
import { Types } from 'mongoose';

describe('AssignmentService - Least Loaded Algorithm', () => {
  let service: AssignmentService;
  let mockListingModel: any;
  let mockUserModel: any;

  const createMockAgent = (
    id: string,
    workload: number,
    lastAssignedAt?: Date,
  ) => ({
    _id: new Types.ObjectId(id),
    fullName: `Agent ${id}`,
    email: `agent${id}@test.com`,
    branchId: 'branch1',
    role: UserRole.REAL_ESTATE_AGENT,
    status: UserStatus.ACTIVE,
    workload,
    lastAssignedAt,
  });

  beforeEach(async () => {
    mockListingModel = {
      countDocuments: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    };

    mockUserModel = {
      find: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssignmentService,
        {
          provide: getModelToken(PropertyListing.name),
          useValue: mockListingModel,
        },
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
      ],
    }).compile();

    service = module.get<AssignmentService>(AssignmentService);
  });

  describe('findBestAgentForAssignment', () => {
    it('should select agent with lowest workload', async () => {
      const agent1 = createMockAgent('111111111111111111111111', 5);
      const agent2 = createMockAgent('222222222222222222222222', 2); // Lowest
      const agent3 = createMockAgent('333333333333333333333333', 8);

      mockUserModel.find.mockResolvedValue([agent1, agent2, agent3]);
      mockListingModel.countDocuments
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(8);

      const result = await service.findBestAgentForAssignment('branch1');

      expect(result.success).toBe(true);
      expect(result.assignedAgentId.toString()).toBe(
        agent2._id.toString(),
      );
    });

    it('should break tie by oldest lastAssignedAt', async () => {
      const now = new Date();
      const agent1 = createMockAgent(
        '111111111111111111111111',
        3,
        new Date(now.getTime() - 1000000), // Older
      );
      const agent2 = createMockAgent(
        '222222222222222222222222',
        3,
        new Date(now.getTime() - 500000), // Newer
      );

      mockUserModel.find.mockResolvedValue([agent1, agent2]);
      mockListingModel.countDocuments
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(3);

      const result = await service.findBestAgentForAssignment('branch1');

      expect(result.success).toBe(true);
      expect(result.assignedAgentId.toString()).toBe(
        agent1._id.toString(),
      );
    });

    it('should use _id as final tie-breaker', async () => {
      const agent1 = createMockAgent('111111111111111111111111', 2);
      const agent2 = createMockAgent('222222222222222222222222', 2);
      const agent3 = createMockAgent('333333333333333333333333', 2);

      mockUserModel.find.mockResolvedValue([agent1, agent2, agent3]);
      mockListingModel.countDocuments
        .mockResolvedValue(2)
        .mockResolvedValue(2)
        .mockResolvedValue(2);

      const result = await service.findBestAgentForAssignment('branch1');

      expect(result.success).toBe(true);
      expect(result.assignedAgentId.toString()).toBe(
        agent1._id.toString(), // First by _id
      );
    });

    it('should return warning when no eligible agents', async () => {
      mockUserModel.find.mockResolvedValue([]);

      const result = await service.findBestAgentForAssignment('branch1');

      expect(result.success).toBe(false);
      expect(result.warning).toContain('No eligible agents');
    });

    it('should reject empty branchId', async () => {
      await expect(
        service.findBestAgentForAssignment(''),
      ).rejects.toThrow('branchId is required');
    });
  });

  describe('assignListingToAgent', () => {
    it('should update listing and agent lastAssignedAt', async () => {
      const listingId = '999999999999999999999999';
      const agentId = new Types.ObjectId('111111111111111111111111');
      const mockListing = {
        _id: new Types.ObjectId(listingId),
        assignedAgentId: agentId,
        assignmentStatus: 'assigned',
        assignedAt: expect.any(Date),
      };

      mockListingModel.findByIdAndUpdate.mockResolvedValue(mockListing);
      mockUserModel.findByIdAndUpdate.mockResolvedValue({
        lastAssignedAt: expect.any(Date),
      });

      const result = await service.assignListingToAgent(
        listingId,
        agentId,
      );

      expect(mockListingModel.findByIdAndUpdate).toHaveBeenCalledWith(
        listingId,
        expect.objectContaining({
          assignedAgentId: agentId,
          assignmentStatus: 'assigned',
        }),
        expect.any(Object),
      );

      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        agentId,
        expect.objectContaining({
          lastAssignedAt: expect.any(Date),
        }),
        expect.any(Object),
      );

      expect(result.assignedAgentId.toString()).toBe(agentId.toString());
    });

    it('should throw NotFoundException if listing not found', async () => {
      mockListingModel.findByIdAndUpdate.mockResolvedValue(null);

      await expect(
        service.assignListingToAgent('999999999999999999999999', new Types.ObjectId()),
      ).rejects.toThrow('not found');
    });
  });

  describe('leaveUnassigned', () => {
    it('should set assignmentStatus to unassigned', async () => {
      const listingId = '999999999999999999999999';
      const mockListing = {
        _id: new Types.ObjectId(listingId),
        assignmentStatus: 'unassigned',
        assignedAgentId: null,
      };

      mockListingModel.findByIdAndUpdate.mockResolvedValue(mockListing);

      const result = await service.leaveUnassigned(listingId);

      expect(mockListingModel.findByIdAndUpdate).toHaveBeenCalledWith(
        listingId,
        {
          assignmentStatus: 'unassigned',
          assignedAgentId: null,
        },
        expect.any(Object),
      );

      expect(result.assignmentStatus).toBe('unassigned');
    });
  });
});
