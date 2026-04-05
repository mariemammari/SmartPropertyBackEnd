import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { PropertySubmissionService } from '../services/property-submission.service';
import { AssignmentService } from '../services/assignment.service';
import {
  Property,
  PropertyStatus,
  PropertyType,
  TransactionType,
} from '../../property/schemas/property.schema';
import {
  PropertyListing,
  ListingStatus,
} from '../../property-listing/schemas/property-listing.schema';
import { User, UserRole, UserStatus } from '../../user/schemas/user.schema';
import { CreatePropertySubmissionDto } from '../dto/create-property-submission.dto';

describe('PropertySubmissionService - Client Submission Flow', () => {
  let service: PropertySubmissionService;
  let assignmentService: AssignmentService;
  let mockPropertyModel: any;
  let mockListingModel: any;
  let mockUserModel: any;

  const clientId = '666666666666666666666666';
  const branchId = '777777777777777777777777';
  const agentId = '888888888888888888888888';

  const createMockSubmissionDto =
    (): CreatePropertySubmissionDto => ({
      branchId,
      propertyType: PropertyType.VILLA,
      type: TransactionType.SALE,
      title: 'Beautiful Villa',
      price: 500000,
      bedrooms: 4,
      bathrooms: 2,
      city: 'Tunis',
      lat: 36.8,
      lng: 10.1,
    });

  beforeEach(async () => {
    mockPropertyModel = {
      create: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    };

    mockListingModel = {
      findByIdAndUpdate: jest.fn(),
      findById: jest.fn(),
      countDocuments: jest.fn(),
      find: jest.fn(),
    };

    mockUserModel = {
      find: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    };

    // Mock AssignmentService methods
    const mockAssignmentService = {
      findBestAgentForAssignment: jest.fn(),
      assignListingToAgent: jest.fn(),
      leaveUnassigned: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PropertySubmissionService,
        {
          provide: AssignmentService,
          useValue: mockAssignmentService,
        },
        {
          provide: getModelToken(Property.name),
          useValue: mockPropertyModel,
        },
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

    service = module.get<PropertySubmissionService>(
      PropertySubmissionService,
    );
    assignmentService = module.get<AssignmentService>(AssignmentService);
  });

  describe('submitProperty', () => {
    it('should reject submission without branchId', async () => {
      const dto = createMockSubmissionDto();
      dto.branchId = '';

      await expect(
        service.submitProperty(clientId, dto),
      ).rejects.toThrow('Valid branchId is required');
    });

    it('should create property with inactive status', async () => {
      const dto = createMockSubmissionDto();

      const mockProperty = {
        _id: new Types.ObjectId(),
        status: PropertyStatus.INACTIVE,
        save: jest.fn().mockResolvedValue({
          _id: new Types.ObjectId(),
          status: PropertyStatus.INACTIVE,
        }),
      };

      mockPropertyModel.create = jest.fn().mockReturnValue(mockProperty);

      const mockListing = {
        _id: new Types.ObjectId(),
        status: ListingStatus.PENDING_REVIEW,
        submittedByClient: true,
        assignmentStatus: 'assigned',
        assignedAgentId: new Types.ObjectId(agentId),
      };

      mockListingModel.findByIdAndUpdate = jest
        .fn()
        .mockResolvedValue(mockListing);

      jest
        .spyOn(assignmentService, 'findBestAgentForAssignment')
        .mockResolvedValue({
          success: true,
          assignedAgentId: new Types.ObjectId(agentId),
        });

      jest
        .spyOn(assignmentService, 'assignListingToAgent')
        .mockResolvedValue(mockListing);

      const result = await service.submitProperty(clientId, dto);

      expect(result.listing.submittedByClient).toBe(true);
      expect(result.listing.status).toBe(ListingStatus.PENDING_REVIEW);
    });

    it('should auto-assign to available agent', async () => {
      const dto = createMockSubmissionDto();

      const mockProperty = {
        _id: new Types.ObjectId(),
        save: jest.fn().mockResolvedValue({}),
      };

      mockPropertyModel.create = jest
        .fn()
        .mockReturnValue(mockProperty);

      const mockListing = {
        _id: new Types.ObjectId(),
        assignedAgentId: new Types.ObjectId(agentId),
        assignmentStatus: 'assigned',
        save: jest.fn().mockResolvedValue({}),
      };

      mockListingModel.create = jest.fn().mockReturnValue(mockListing);

      jest
        .spyOn(assignmentService, 'findBestAgentForAssignment')
        .mockResolvedValue({
          success: true,
          assignedAgentId: new Types.ObjectId(agentId),
        });

      jest
        .spyOn(assignmentService, 'assignListingToAgent')
        .mockResolvedValue(mockListing);

      mockListingModel.findByIdAndUpdate.mockResolvedValue(mockListing);

      const result = await service.submitProperty(clientId, dto);

      expect(assignmentService.findBestAgentForAssignment).toHaveBeenCalledWith(
        branchId,
      );
      expect(assignmentService.assignListingToAgent).toHaveBeenCalled();
      expect(result.assignmentWarning).toBeUndefined();
    });

    it('should leave unassigned if no agents available', async () => {
      const dto = createMockSubmissionDto();

      const mockProperty = {
        _id: new Types.ObjectId(),
        save: jest.fn().mockResolvedValue({}),
      };

      mockPropertyModel.create = jest
        .fn()
        .mockReturnValue(mockProperty);

      const mockListing = {
        _id: new Types.ObjectId(),
        assignmentStatus: 'unassigned',
        save: jest.fn().mockResolvedValue({}),
      };

      mockListingModel.create = jest.fn().mockReturnValue(mockListing);

      jest
        .spyOn(assignmentService, 'findBestAgentForAssignment')
        .mockResolvedValue({
          success: false,
          warning: 'No eligible agents available in this branch',
          message: 'Request will remain unassigned',
        });

      mockListingModel.findByIdAndUpdate.mockResolvedValue(mockListing);

      const result = await service.submitProperty(clientId, dto);

      expect(result.assignmentWarning).toContain('No eligible agents');
      expect(result.listing.assignmentStatus).toBe('unassigned');
    });
  });

  describe('approveSubmission', () => {
    it('should transition listing to approved and property to available', async () => {
      const listingId = new Types.ObjectId();

      const mockListing = {
        _id: listingId,
        assignedAgentId: new Types.ObjectId(agentId),
        propertyId: new Types.ObjectId(),
        status: ListingStatus.PENDING_REVIEW,
        agentComments: [],
        save: jest.fn(),
      };

      mockListing.save.mockResolvedValue({
        ...mockListing,
        status: ListingStatus.APPROVED,
        reviewedBy: new Types.ObjectId(agentId),
        reviewedAt: expect.any(Date),
      });

      mockListingModel.findById.mockResolvedValue(mockListing);
      mockPropertyModel.findByIdAndUpdate.mockResolvedValue({
        status: PropertyStatus.AVAILABLE,
      });

      const result = await service.approveSubmission(
        listingId.toString(),
        agentId,
        { agentComments: 'Looks good!' },
      );

      expect(result.status).toBe(ListingStatus.APPROVED);
      expect(mockListingModel.findById).toHaveBeenCalledWith(listingId.toString());
      expect(mockPropertyModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockListing.propertyId,
        { status: PropertyStatus.AVAILABLE },
      );
    });

    it('should reject if user is not assigned agent', async () => {
      const listingId = new Types.ObjectId();
      const otherAgentId = '999999999999999999999999';

      const mockListing = {
        _id: listingId,
        assignedAgentId: new Types.ObjectId(agentId),
      };

      mockListingModel.findById.mockResolvedValue(mockListing);

      await expect(
        service.approveSubmission(listingId.toString(), otherAgentId, {}),
      ).rejects.toThrow('Only the assigned agent');
    });
  });

  describe('rejectSubmission', () => {
    it('should transition listing to rejected', async () => {
      const listingId = new Types.ObjectId();

      const mockListing = {
        _id: listingId,
        assignedAgentId: new Types.ObjectId(agentId),
        status: ListingStatus.PENDING_REVIEW,
        agentComments: [],
        save: jest.fn(),
      };

      mockListing.save.mockResolvedValue({
        ...mockListing,
        status: ListingStatus.REJECTED,
        rejectionReason: 'Poor photos',
        reviewedBy: new Types.ObjectId(agentId),
        reviewedAt: expect.any(Date),
      });

      mockListingModel.findById.mockResolvedValue(mockListing);

      const result = await service.rejectSubmission(
        listingId.toString(),
        agentId,
        { rejectionReason: 'Poor photos' },
      );

      expect(result.status).toBe(ListingStatus.REJECTED);
      expect(result.rejectionReason).toBe('Poor photos');
    });
  });

  describe('getAssignedPendingSubmissions', () => {
    it('should return only submissions assigned to agent', async () => {
      const mockListings = [
        {
          _id: new Types.ObjectId(),
          assignedAgentId: new Types.ObjectId(agentId),
          status: ListingStatus.PENDING_REVIEW,
          submittedByClient: true,
        },
      ];

      mockListingModel.countDocuments.mockResolvedValue(1);
      mockListingModel.find.mockReturnThis();
      mockListingModel.populate.mockReturnThis();
      mockListingModel.sort.mockReturnThis();
      mockListingModel.skip.mockReturnThis();
      mockListingModel.limit.mockResolvedValue(mockListings);

      const result = await service.getAssignedPendingSubmissions(agentId);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });
});
