
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Property, PropertyDocument, PropertyStatus } from '../property/schemas/property.schema';
import { PropertyListing, PropertyListingDocument } from '../property-listing/schemas/property-listing.schema';
import { User, UserDocument } from '../user/schemas/user.schema';
import { RentalService } from '../rental/rental.service';
import { CreatePropertyDto, UpdatePropertyDto, PropertyFilterDto } from '../property/dto/create-property.dto';

@Injectable()
export class PropertyService {
  constructor(
    @InjectModel(Property.name) private propertyModel: Model<PropertyDocument>,
    @InjectModel(PropertyListing.name) private listingModel: Model<PropertyListingDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly rentalService: RentalService,
  ) { }

  // ── Create ────────────────────────────────────────────────────────────────
  async create(dto: CreatePropertyDto): Promise<Property> {
    const data: any = {
      ...dto,
      ownerId: new Types.ObjectId(dto.ownerId),
      createdBy: dto.createdBy ? new Types.ObjectId(dto.createdBy) : null,
    };

    // Keep GeoJSON location in sync when valid coordinates are provided.
    if (Number.isFinite(dto.lat) && Number.isFinite(dto.lng)) {
      data.location = { type: 'Point', coordinates: [dto.lng, dto.lat] };
    } else {
      delete data.location; // ← supprimer location si pas de coords
    }

    return new this.propertyModel(data).save();
  }

  // ── Find All (with filters + pagination) ─────────────────────────────────
  async findAll(filters: PropertyFilterDto): Promise<{ data: Property[]; total: number; page: number; pages: number }> {
    const {
      page = 1, limit = 8,
      minPrice, maxPrice, minSize, maxSize,
      type, propertyType, propertySubType, status, condition,
      city, state, bedrooms, bathrooms,
      hasParking, hasElevator, hasPool, hasAirConditioning,
      ownerId, createdBy,
    } = filters;

    console.log('🔍 [PropertyService.findAll] Raw filters received:', filters);

    const query: Record<string, any> = {};

    // Enum filters
    if (type) query.type = type;
    if (propertyType) query.propertyType = propertyType;
    if (propertySubType) query.propertySubType = propertySubType;
    if (status) query.status = status;
    if (condition) query.condition = condition;

    // Text filters (case-insensitive)
    if (city) query.city = { $regex: city, $options: 'i' };
    if (state) query.state = { $regex: state, $options: 'i' };

    // Range filters - convert to numbers for proper numeric comparison
    if (minPrice !== undefined || maxPrice !== undefined) {
      query.price = {};
      if (minPrice !== undefined) query.price.$gte = Number(minPrice);
      if (maxPrice !== undefined) query.price.$lte = Number(maxPrice);
    }
    if (minSize !== undefined || maxSize !== undefined) {
      query.size = {};
      if (minSize !== undefined) query.size.$gte = Number(minSize);
      if (maxSize !== undefined) query.size.$lte = Number(maxSize);
    }

    // Exact matches - convert to numbers for proper MongoDB comparison
    if (bedrooms !== undefined) query.bedrooms = Number(bedrooms);
    if (bathrooms !== undefined) query.bathrooms = Number(bathrooms);

    // Boolean amenities - now properly typed as boolean from DTO transformation
    if (hasParking) query.hasParking = true;
    if (hasElevator) query.hasElevator = true;
    if (hasPool) query.hasPool = true;
    if (hasAirConditioning) query.hasAirConditioning = true;

    // Owner / agent filters
    if (ownerId) query.ownerId = new Types.ObjectId(ownerId);
    if (createdBy) query.createdBy = new Types.ObjectId(createdBy);

    console.log('📋 [PropertyService.findAll] Built MongoDB query:', JSON.stringify(query, null, 2));
    console.log('📄 [PropertyService.findAll] Page:', page, 'Limit:', limit);

    const skip = (page - 1) * limit;
    const total = await this.propertyModel.countDocuments(query);
    console.log('📊 [PropertyService.findAll] Total matching documents:', total);

    const data = await this.propertyModel
      .find(query)
      .populate('ownerId', 'name email phone')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    console.log('✅ [PropertyService.findAll] Returned', data.length, 'properties');

    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  // ── Find One ──────────────────────────────────────────────────────────────
  async findOne(id: string): Promise<Property> {
    const property = await this.propertyModel
      .findById(id)
      .populate('ownerId', 'name email phone')
      .populate('createdBy', 'name email')
      .exec();
    if (!property) throw new NotFoundException(`Property ${id} not found`);
    return property;
  }

  // ── Find by Owner ─────────────────────────────────────────────────────────
  async findByOwner(ownerId: string): Promise<Property[]> {
    return this.propertyModel
      .find({ ownerId: new Types.ObjectId(ownerId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  // ── Find by Agent ─────────────────────────────────────────────────────────
  async findByAgent(agentId: string): Promise<Property[]> {
    return this.propertyModel
      .find({ createdBy: new Types.ObjectId(agentId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  // ── Find Rented by Owner ─────────────────────────────────────────────────
  async findRentedByOwner(ownerId: string): Promise<Property[]> {
    console.log(`🔍 [findRentedByOwner] Searching for rented properties with ownerId: ${ownerId}`);

    const result = await this.propertyModel
      .find({
        ownerId: new Types.ObjectId(ownerId),
        status: PropertyStatus.RENTED
      })
      .populate('ownerId', 'name email phone')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .exec();

    console.log(`✅ [findRentedByOwner] Found ${result.length} rented properties`);
    return result;
  }

  // ── Find Rented by Branch ─────────────────────────────────────────────────
  async findRentedByBranch(branchId: string): Promise<Property[]> {
    console.log(`🔍 [findRentedByBranch] Searching for rented properties with branchId: ${branchId}`);

    const usersInBranch = await this.userModel
      .find({ branchId: branchId.toString() })
      .select('_id')
      .lean()
      .exec();
    const creatorIds = usersInBranch.map((u: any) => u._id);

    // Return rented properties linked to branch either directly on property or via creator's branch.
    const result = await this.propertyModel
      .find({
        status: PropertyStatus.RENTED,
        $or: [
          { branchId: branchId.toString() },
          ...(creatorIds.length > 0 ? [{ createdBy: { $in: creatorIds } }] : []),
        ],
      })
      .populate('ownerId', 'name email phone')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .exec();

    console.log(`✅ [findRentedByBranch] Found ${result.length} rented properties`);
    return result;
  }

  // ── Find Rented by Agent ──────────────────────────────────────────────────
  async findRentedByAgent(agentId: string): Promise<Property[]> {
    console.log(`🔍 [findRentedByAgent] Searching for rented properties with agentId: ${agentId}`);

    // Now filter for rented only using enum
    const result = await this.propertyModel
      .find({
        createdBy: new Types.ObjectId(agentId),
        status: PropertyStatus.RENTED
      })
      .populate('ownerId', 'name email phone')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .exec();

    console.log(`✅ [findRentedByAgent] Found ${result.length} rented properties`);
    return result;
  }

  // ── Update ────────────────────────────────────────────────────────────────
  async update(id: string, dto: UpdatePropertyDto): Promise<Property> {
    const existing = await this.propertyModel.findById(id).exec();
    if (!existing) throw new NotFoundException(`Property ${id} not found`);

    // Extract rental trigger fields before applying update to property
    const {
      tenantId, propertyListingId, durationMonths, paymentFrequencyMonths,
      autoRenew, noticePeriodDays, contractSignedAt, moveInDate, moveOutDate, notes,
      ...propertyUpdate
    } = dto;

    const update: any = { ...propertyUpdate };

    // Re-sync GeoJSON if lat/lng updated
    if (Number.isFinite(dto.lat) && Number.isFinite(dto.lng)) {
      update.location = { type: 'Point', coordinates: [dto.lng, dto.lat] };
    } else if (dto.lat !== undefined || dto.lng !== undefined) {
      update.$unset = { ...(update.$unset || {}), location: '' };
    }

    const property = await this.propertyModel
      .findByIdAndUpdate(id, update, { new: true })
      .exec();
    if (!property) throw new NotFoundException(`Property ${id} not found`);

    if (dto.status === PropertyStatus.RENTED && existing.status !== PropertyStatus.RENTED) {
      console.log(`🔷 [PropertyService.update] Status changed to RENTED. Creating rental for property:`, property._id);
      try {
        await this.rentalService.createFromPropertyStatusChange({
          propertyId: property._id.toString(),
          propertyListingId,
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
        console.log(`✅ [PropertyService.update] Rental created successfully for property:`, property._id);
      } catch (error: any) {
        console.log(`❌ [PropertyService.update] Failed to create rental:`, error.message);
        throw error;
      }
    }

    return property;
  }

  // ── Remove ────────────────────────────────────────────────────────────────
  async remove(id: string): Promise<any> {
    console.log('🗑️ Deleting property:', id);

    // Convert string id to ObjectId for proper comparison
    const propertyObjectId = new Types.ObjectId(id);

    console.log('🔍 Looking for listings with propertyId (string or ObjectId):', id);

    // ⭐ DELETE ALL LISTINGS ASSOCIATED WITH THIS PROPERTY
    // Query for BOTH string and ObjectId formats in case data is stored as string
    const deleteResult = await this.listingModel.deleteMany({
      $or: [
        { propertyId: propertyObjectId },  // In case it's stored as ObjectId
        { propertyId: id }                  // In case it's stored as string
      ]
    });
    console.log('📊 Listings deleted count:', deleteResult.deletedCount);

    // ⭐ THEN DELETE THE PROPERTY ITSELF
    const result = await this.propertyModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException(`Property ${id} not found`);

    console.log('✅ Property deleted:', id);
    return {
      message: 'Property and associated listings deleted successfully',
      listingsDeleted: deleteResult.deletedCount,
      propertyDeleted: true
    };
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  async getStats(): Promise<any> {
    const [total, forRent, forSale, available, rented, sold] = await Promise.all([
      this.propertyModel.countDocuments(),
      this.propertyModel.countDocuments({ type: 'rent' }),
      this.propertyModel.countDocuments({ type: 'sale' }),
      this.propertyModel.countDocuments({ status: 'available' }),
      this.propertyModel.countDocuments({ status: 'rented' }),
      this.propertyModel.countDocuments({ status: 'sold' }),
    ]);
    return { total, forRent, forSale, available, rented, sold };
  }
}
