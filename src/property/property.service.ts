
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Property, PropertyDocument } from '../property/schemas/property.schema';
import { PropertyListing, PropertyListingDocument } from '../property-listing/schemas/property-listing.schema';
import { CreatePropertyDto, UpdatePropertyDto, PropertyFilterDto } from '../property/dto/create-property.dto';

@Injectable()
export class PropertyService {
  constructor(
    @InjectModel(Property.name) private propertyModel: Model<PropertyDocument>,
    @InjectModel(PropertyListing.name) private listingModel: Model<PropertyListingDocument>,
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

    // Range filters
    if (minPrice !== undefined || maxPrice !== undefined) {
      query.price = {};
      if (minPrice !== undefined) query.price.$gte = minPrice;
      if (maxPrice !== undefined) query.price.$lte = maxPrice;
    }
    if (minSize !== undefined || maxSize !== undefined) {
      query.size = {};
      if (minSize !== undefined) query.size.$gte = minSize;
      if (maxSize !== undefined) query.size.$lte = maxSize;
    }

    // Exact matches
    if (bedrooms !== undefined) query.bedrooms = bedrooms;
    if (bathrooms !== undefined) query.bathrooms = bathrooms;

    // Boolean amenities
    if (hasParking) query.hasParking = true;
    if (hasElevator) query.hasElevator = true;
    if (hasPool) query.hasPool = true;
    if (hasAirConditioning) query.hasAirConditioning = true;

    // Owner / agent filters
    if (ownerId) query.ownerId = new Types.ObjectId(ownerId);
    if (createdBy) query.createdBy = new Types.ObjectId(createdBy);

    const skip = (page - 1) * limit;
    const total = await this.propertyModel.countDocuments(query);
    const data = await this.propertyModel
      .find(query)
      .populate('ownerId', 'name email phone')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

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

  // ── Update ────────────────────────────────────────────────────────────────
  async update(id: string, dto: UpdatePropertyDto): Promise<Property> {
    const update: any = { ...dto };

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
