import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  PropertyListing,
  PropertyListingDocument,
  ListingStatus,
} from '../property-listing/schemas/property-listing.schema';
import {
  CreatePropertyListingDto,
  UpdatePropertyListingDto,
  ListingFilterDto,
} from '../property-listing/dto/Property-listing.dto';
import { RentalService } from '../rental/rental.service';

@Injectable()
export class PropertyListingService {
  constructor(
    @InjectModel(PropertyListing.name)
    private listingModel: Model<PropertyListingDocument>,
    private readonly rentalService: RentalService,
  ) { }

  // ── Create ────────────────────────────────────────────────────────────────
  async create(dto: CreatePropertyListingDto): Promise<PropertyListing> {
    const data: any = {
      ...dto,
      propertyId: new Types.ObjectId(dto.propertyId),
      ownerId: new Types.ObjectId(dto.ownerId),
      createdBy: new Types.ObjectId(dto.createdBy),
      agentId: dto.agentId ? new Types.ObjectId(dto.agentId) : undefined,
      branchId: dto.branchId ? new Types.ObjectId(dto.branchId) : undefined,
      status: dto.status ?? ListingStatus.DRAFT,
    };
    return new this.listingModel(data).save();
  }

  // ── Find All ──────────────────────────────────────────────────────────────
  async findAll(filters: ListingFilterDto): Promise<{
    data: PropertyListing[];
    total: number;
    page: number;
    pages: number;
  }> {
    const { page = 1, limit = 10, propertyId, ownerId, agentId, status } = filters;
    const query: Record<string, any> = {};

    if (propertyId) query.propertyId = new Types.ObjectId(propertyId);
    if (ownerId) query.ownerId = new Types.ObjectId(ownerId);
    if (agentId) query.agentId = new Types.ObjectId(agentId);
    if (status) query.status = status;

    const skip = (page - 1) * limit;
    const total = await this.listingModel.countDocuments(query);
    const data = await this.listingModel
      .find(query)
      .populate('propertyId', 'propertyType propertySubType city state size bedrooms bathrooms')
      .populate('ownerId', 'name email phone')
      .populate('agentId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  // ── Find One ──────────────────────────────────────────────────────────────
  async findOne(id: string): Promise<PropertyListing> {
    const listing = await this.listingModel
      .findById(id)
      .populate('propertyId')
      .populate('ownerId', 'name email phone')
      .populate('agentId', 'name email')
      .populate('createdBy', 'name email')
      .exec();
    if (!listing) throw new NotFoundException(`Listing ${id} not found`);
    return listing;
  }

  // ── Find by Property (all listings for one property) ─────────────────────
  async findByProperty(propertyId: string): Promise<PropertyListing[]> {
    return this.listingModel
      .find({ propertyId: new Types.ObjectId(propertyId) })
      .populate('agentId', 'name email')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .exec();
  }

  // ── Find by Branch (all listings for one branch) ────────────────────────
  async findByBranch(branchId: string): Promise<PropertyListing[]> {
    return this.listingModel
      .find({ branchId: new Types.ObjectId(branchId) })
      .populate('propertyId', 'propertyType propertySubType city state size bedrooms bathrooms')
      .populate('agentId', 'name email')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .exec();
  }

  // ── Find Active Listing for a Property ───────────────────────────────────
  async findActiveListing(propertyId: string): Promise<PropertyListing | null> {
    return this.listingModel
      .findOne({
        propertyId: new Types.ObjectId(propertyId),
        status: {
          $in: [
            ListingStatus.ACTIVE,
            ListingStatus.APPROVED,
            ListingStatus.DRAFT,        // est ce vraiment on a "approving"
            ListingStatus.PENDING_REVIEW // 
          ]
        },
      })
      .populate('agentId', 'name email')
      .populate('createdBy', 'name email')
      .populate('propertyId')
      .exec();
  }

  // ── Find Reference Number by Property ID ────────────────────────────────
  async findReferenceByPropertyId(propertyId: string): Promise<{ referenceNumber: string } | null> {
    const listing = await this.listingModel
      .findOne({ propertyId: new Types.ObjectId(propertyId) })
      .select('referenceNumber')
      .exec();

    if (!listing) return null;
    return { referenceNumber: listing.referenceNumber };
  }

  // ── Get Agent Info by Property ID ───────────────────────────────────────
  async getAgentByPropertyId(propertyId: string): Promise<any> {
    const listing = await this.listingModel
      .findOne({ propertyId: new Types.ObjectId(propertyId) })
      .select('agentId createdBy')
      .populate('agentId', 'name email phone')
      .populate('createdBy', 'name email phone')
      .exec();

    if (!listing) return null;
    return { agentId: listing.agentId, createdBy: listing.createdBy };
  }

  // ── Update ────────────────────────────────────────────────────────────────
  async update(id: string, dto: UpdatePropertyListingDto): Promise<PropertyListing> {
    const existing = await this.listingModel.findById(id).exec();
    if (!existing) throw new NotFoundException(`Listing ${id} not found`);

    // Extract rental trigger fields before applying update to listing
    const {
      tenantId, durationMonths, paymentFrequencyMonths,
      autoRenew, noticePeriodDays, contractSignedAt, moveInDate, moveOutDate, notes,
      ...listingUpdate
    } = dto;

    const update: any = { ...listingUpdate };

    if (dto.agentId) update.agentId = new Types.ObjectId(dto.agentId);
    if (dto.branchId) update.branchId = new Types.ObjectId(dto.branchId);

    // Auto-set publishedAt when status goes ACTIVE
    if (dto.status === ListingStatus.ACTIVE) {
      update.publishedAt = new Date();
    }

    // Auto-set reviewedAt when APPROVED or REJECTED
    if (dto.status === ListingStatus.APPROVED || dto.status === ListingStatus.REJECTED) {
      update.reviewedAt = new Date();
    }

    const listing = await this.listingModel
      .findByIdAndUpdate(id, update, { new: true })
      .exec();
    if (!listing) throw new NotFoundException(`Listing ${id} not found`);

    if (dto.status === ListingStatus.RENTED && existing.status !== ListingStatus.RENTED) {
      await this.rentalService.createFromListingStatusChange(listing._id.toString(), {
        propertyId: listing.propertyId.toString(),
        tenantId,
        durationMonths,
        paymentFrequencyMonths,
        autoRenew,
        noticePeriodDays,
        contractSignedAt,
        moveInDate,
        moveOutDate,
        notes,
      });
    }

    return listing;
  }

  // ── Submit for Review ─────────────────────────────────────────────────────
  async submitForReview(id: string): Promise<PropertyListing> {
    const listing = await this.listingModel.findByIdAndUpdate(
      id,
      {
        status: ListingStatus.PENDING_REVIEW,
        submittedForReviewAt: new Date(),
      },
      { new: true },
    ).exec();
    if (!listing) throw new NotFoundException(`Listing ${id} not found`);
    return listing;
  }

  // ── Archive ───────────────────────────────────────────────────────────────
  async archive(id: string): Promise<PropertyListing> {
    return this.update(id, { status: ListingStatus.ARCHIVED });
  }

  // ── Remove ────────────────────────────────────────────────────────────────
  async remove(id: string): Promise<void> {
    const result = await this.listingModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException(`Listing ${id} not found`);
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  async getStats(): Promise<any> {
    const statuses = Object.values(ListingStatus);
    const counts = await Promise.all(
      statuses.map(s => this.listingModel.countDocuments({ status: s }).then(c => ({ [s]: c }))),
    );
    const total = await this.listingModel.countDocuments();
    return { total, ...Object.assign({}, ...counts) };
  }
}