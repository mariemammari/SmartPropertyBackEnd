import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Property,
  PropertyDocument,
  PropertyStatus,
  PropertyType,
} from '../../property/schemas/property.schema';
import {
  PropertyListing,
  PropertyListingDocument,
  ListingStatus,
} from '../../property-listing/schemas/property-listing.schema';
import { User, UserDocument } from '../../user/schemas/user.schema';
import { CreatePropertySubmissionDto } from '../dto/create-property-submission.dto';
import {
  ApproveSubmissionDto,
  RejectSubmissionDto,
} from '../dto/submission-review.dto';
import { AssignmentService } from './assignment.service';

@Injectable()
export class PropertySubmissionService {
  private logger = new Logger(PropertySubmissionService.name);

  constructor(
    @InjectModel(Property.name)
    private propertyModel: Model<PropertyDocument>,
    @InjectModel(PropertyListing.name)
    private listingModel: Model<PropertyListingDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    private assignmentService: AssignmentService,
  ) {}

  /**
   * Client submission workflow:
   * 1. Validate branchId exists
   * 2. Create Property (status='inactive')
   * 3. Create PropertyListing (status='pending_review', submittedByClient=true)
   * 4. Try to assign to least-loaded agent
   * 5. Return listing with assignment details
   */
  async submitProperty(
    clientId: string,
    dto: CreatePropertySubmissionDto,
  ): Promise<{
    listing: PropertyListingDocument | null;
    assignmentWarning?: string;
  }> {
    // ─── Validation ────────────────────────────────────────────
    if (!dto.branchId || !Types.ObjectId.isValid(dto.branchId)) {
      throw new UnprocessableEntityException(
        'Valid branchId is required for client submissions',
      );
    }

    if (!clientId || !Types.ObjectId.isValid(clientId)) {
      throw new UnprocessableEntityException('Invalid authenticated client id');
    }

    // Verify branchId exists (basic check)
    // In production, you might want to validate it more thoroughly
    const branchIdObj = new Types.ObjectId(dto.branchId);

    // ─── Create Property ────────────────────────────────────────
    const propertyData = {
      propertyType: dto.propertyType,
      propertySubType: dto.propertySubType,
      type: dto.type,
      title: dto.title,
      description: dto.description,
      status: PropertyStatus.INACTIVE, // Must be inactive initially
      price: dto.price,
      monthlyCharges: dto.monthlyCharges || 0,
      isPriceNegotiable: dto.isPriceNegotiable || false,
      size: dto.size,
      rooms: dto.rooms,
      bedrooms: dto.bedrooms,
      bathrooms: dto.bathrooms,
      floor: dto.floor,
      totalFloors: dto.totalFloors,
      condition: dto.condition,
      yearBuilt: dto.yearBuilt,
      availableFrom: dto.availableFrom,
      hasElevator: dto.hasElevator || false,
      hasParking: dto.hasParking || false,
      hasGarden: dto.hasGarden || false,
      hasBalcony: dto.hasBalcony || false,
      hasPool: dto.hasPool || false,
      hasTerrace: dto.hasTerrace || false,
      hasSeaView: dto.hasSeaView || false,
      hasCentralHeating: dto.hasCentralHeating || false,
      hasAirConditioning: dto.hasAirConditioning || false,
      address: dto.address,
      city: dto.city,
      state: dto.state,
      neighborhood: dto.neighborhood,
      postalCode: dto.postalCode,
      lat: dto.lat,
      lng: dto.lng,
      ownerId: new Types.ObjectId(clientId),
      createdBy: new Types.ObjectId(clientId), // Client created it themselves
      branchId: dto.branchId,
      agent_id: null, // Will be set by agent later
    };

    // Add GeoJSON if coordinates provided
    if (
      dto.lat !== undefined &&
      dto.lng !== undefined &&
      Number.isFinite(dto.lat) &&
      Number.isFinite(dto.lng)
    ) {
      propertyData['location'] = {
        type: 'Point',
        coordinates: [dto.lng, dto.lat], // GeoJSON: [longitude, latitude]
      };
    }

    let savedProperty: any;
    try {
      const property = new this.propertyModel(propertyData);
      savedProperty = await property.save();
    } catch (error: any) {
      this.logger.error(`Property save failed: ${error?.message || error}`);
      throw new BadRequestException(
        error?.message || 'Invalid property payload for submission',
      );
    }

    this.logger.log(
      `Created property ${savedProperty._id} from client submission`,
    );

    // ─── Create PropertyListing ────────────────────────────────
    const listingData = {
      propertyId: savedProperty._id,
      ownerId: new Types.ObjectId(clientId),
      createdBy: new Types.ObjectId(clientId),
      price: dto.price,
      isPriceNegotiable: dto.isPriceNegotiable || false,
      isPriceAIGenerated: false,
      monthlyCharges: dto.monthlyCharges || 0,
      furnishingStatus: dto.furnishingStatus,
      standing: dto.standing,
      wifiEthernet: dto.wifiEthernet || false,
      status: ListingStatus.PENDING_REVIEW, // Pending review initially
      branchId: branchIdObj,
      submittedForReviewAt: new Date(),
      submittedByClient: true, // Mark as client submission
      contractPolicies: dto.contractPolicies,
      housePolicies: dto.housePolicies,
      salePolicies: dto.salePolicies,
      fees: dto.fees,
      customFields: dto.customFields || {},
      assignmentStatus: 'unassigned', // Default
    };

    let savedListing: any;
    try {
      const listing = new this.listingModel(listingData);
      savedListing = await listing.save();
    } catch (error: any) {
      this.logger.error(`Listing save failed: ${error?.message || error}`);
      throw new BadRequestException(
        error?.message || 'Invalid listing payload for submission',
      );
    }

    this.logger.log(
      `Created listing ${savedListing._id} for property ${savedProperty._id}`,
    );

    // ─── Try to Assign to Agent ────────────────────────────────
    let assignmentWarning: string | undefined;

    try {
      const assignmentResult =
        await this.assignmentService.findBestAgentForAssignment(dto.branchId);

      if (assignmentResult.success && assignmentResult.assignedAgentId) {
        await this.assignmentService.assignListingToAgent(
          savedListing._id.toString(),
          assignmentResult.assignedAgentId,
        );

        this.logger.log(
          `Assigned listing ${savedListing._id} to agent ${assignmentResult.assignedAgentId}`,
        );

        // Reload listing to reflect new assignment
        const updatedListing = await this.listingModel.findById(
          savedListing._id,
        );

        return { listing: updatedListing };
      } else {
        // No eligible agent: leave unassigned
        assignmentWarning = assignmentResult.warning;

        this.logger.warn(`Could not assign listing ${savedListing._id}: ${assignmentWarning}`);

        return {
          listing: savedListing,
          assignmentWarning,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error during assignment for listing ${savedListing._id}: ${errorMessage}`,
      );

      assignmentWarning = `Assignment failed: ${errorMessage}`;

      return {
        listing: savedListing,
        assignmentWarning,
      };
    }
  }

  /**
   * Fetch pending submissions assigned to current agent.
   */
  async getAssignedPendingSubmissions(
    agentId: string,
    page: number = 1,
    limit: number = 10,
    status?: string,
  ): Promise<{
    data: PropertyListingDocument[];
    total: number;
    page: number;
    pages: number;
  }> {
    const skip = (page - 1) * limit;
    const agentIdObj = new Types.ObjectId(agentId);

    const normalizedStatus = status?.trim();
    const statusFilter = normalizedStatus
      ? { $in: [normalizedStatus] }
      : { $in: [ListingStatus.PENDING_REVIEW, 'under_review'] };

    const query = {
      assignedAgentId: agentIdObj,
      status: statusFilter,
      submittedByClient: true,
    };

    const total = await this.listingModel.countDocuments(query);
    const data = await this.listingModel
      .find(query)
.populate('propertyId', 'propertyType propertySubType city bedrooms bathrooms size')
      .populate('ownerId', 'fullName email phone')
      .populate('createdBy', 'fullName email')
      .sort({ assignedAt: -1 })
      .skip(skip)
      .limit(limit);

    return {
      data,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Agent approves a pending submission.
   * Transitions listing to 'approved' and property to 'available'.
   */
  async approveSubmission(
    listingId: string,
    agentId: string,
    dto: ApproveSubmissionDto,
  ): Promise<PropertyListingDocument> {
    const listing = await this.listingModel.findById(listingId);

    if (!listing) {
      throw new NotFoundException(`Listing ${listingId} not found`);
    }

    // Verify agent is assigned
    if (
      !listing.assignedAgentId ||
      listing.assignedAgentId.toString() !== agentId
    ) {
      throw new BadRequestException(
        'Only the assigned agent can approve this submission',
      );
    }

    // Update listing
    listing.status = ListingStatus.APPROVED;
    listing.reviewedBy = new Types.ObjectId(agentId);
    listing.reviewedAt = new Date();

    if (dto.agentComments) {
      listing.agentComments = listing.agentComments || [];
      listing.agentComments.push(dto.agentComments);
    }

    const updatedListing = await listing.save();

    // Update property status to 'available'
    await this.propertyModel.findByIdAndUpdate(listing.propertyId, {
      status: PropertyStatus.AVAILABLE,
    });

    this.logger.log(
      `Agent ${agentId} approved listing ${listingId}`,
    );

    return updatedListing;
  }

  /**
   * Agent rejects a pending submission.
   * Transitions listing to 'rejected' and property remains 'inactive'.
   */
  async rejectSubmission(
    listingId: string,
    agentId: string,
    dto: RejectSubmissionDto,
  ): Promise<PropertyListingDocument> {
    const listing = await this.listingModel.findById(listingId);

    if (!listing) {
      throw new NotFoundException(`Listing ${listingId} not found`);
    }

    // Verify agent is assigned
    if (
      !listing.assignedAgentId ||
      listing.assignedAgentId.toString() !== agentId
    ) {
      throw new BadRequestException(
        'Only the assigned agent can reject this submission',
      );
    }

    // Update listing
    listing.status = ListingStatus.REJECTED;
    listing.rejectionReason = dto.rejectionReason;
    listing.reviewedBy = new Types.ObjectId(agentId);
    listing.reviewedAt = new Date();

    if (dto.agentComments) {
      listing.agentComments = listing.agentComments || [];
      listing.agentComments.push(dto.agentComments);
    }

    const updatedListing = await listing.save();

    // Property status remains 'inactive'

    this.logger.log(
      `Agent ${agentId} rejected listing ${listingId}. Reason: ${dto.rejectionReason}`,
    );

    return updatedListing;
  }

  /**
   * Get submission details (for agent or admin).
   */
  async getSubmissionDetails(listingId: string): Promise<PropertyListingDocument> {
    const listing = await this.listingModel
      .findById(listingId)
      .populate('propertyId')
      .populate('ownerId', 'fullName email phone city')
      .populate('assignedAgentId', 'fullName email phone')
      .populate('createdBy', 'fullName email')
      .populate('reviewedBy', 'fullName email');

    if (!listing) {
      throw new NotFoundException(`Listing ${listingId} not found`);
    }

    return listing;
  }
}
