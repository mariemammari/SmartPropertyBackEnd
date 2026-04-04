import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PropertyDocument = Property & Document;

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum TransactionType {
  RENT = 'rent',
  SALE = 'sale',
}

export enum PropertyType {
  APARTMENT = 'apartment',
  VILLA = 'villa',
  HOUSE = 'house',
  STUDIO = 'studio',
  DUPLEX = 'duplex',
  OFFICE = 'office',
  COMMERCIAL = 'commercial',
  LAND = 'land',
  GARAGE = 'garage',
  WAREHOUSE = 'warehouse',
}

export enum PropertySubType {
  S = 'S',
  S1 = 'S+1',
  S2 = 'S+2',
  S3 = 'S+3',
  S4 = 'S+4',
  S5 = 'S+5',
}

export enum PropertyCondition {
  NEW = 'new',
  EXCELLENT = 'excellent',
  GOOD = 'good',
  NEEDS_RENOVATION = 'needs_renovation',
  UNDER_CONSTRUCTION = 'under_construction',
}

export enum PropertyStatus {
  AVAILABLE = 'available',
  RENTED = 'rented',
  SOLD = 'sold',
  INACTIVE = 'inactive',
}

// ─── Schema ───────────────────────────────────────────────────────────────────

@Schema({ timestamps: true, collection: 'properties' })
export class Property {

  // ─── Classification (replaces title) ────────────────────────
  // propertyType IS the identifier — e.g. "Villa à Carthage, S+3"
  @Prop({ required: true, enum: PropertyType, index: true })
  propertyType!: PropertyType;

  @Prop({ enum: PropertySubType })
  propertySubType?: PropertySubType;

  // 'type' kept for backward compat (rent/sale)
  @Prop({ required: true, enum: TransactionType })
  type!: string;

  @Prop()
  title?: string;

  @Prop()
  description?: string;

  // ─── Status ──────────────────────────────────────────────────
  @Prop({ default: PropertyStatus.AVAILABLE, enum: PropertyStatus })
  status!: string;

  // ─── Pricing ─────────────────────────────────────────────────
  @Prop({ required: true, min: 0 })
  price!: number;

  @Prop({ min: 0, default: 0 })
  monthlyCharges!: number;

  @Prop({ default: false })
  isPriceNegotiable!: boolean;

  // ─── Surface & Rooms ─────────────────────────────────────────
  @Prop({ min: 0 }) size?: number; // kept for backward compat = surfaceM2
  @Prop({ min: 0 }) rooms?: number;
  @Prop({ min: 0 }) bedrooms?: number;
  @Prop({ min: 0 }) bathrooms?: number;

  // ─── Floor ───────────────────────────────────────────────────
  @Prop({ type: Number, min: 0, default: null }) floor!: number | null;
  @Prop({ min: 0 }) totalFloors?: number;

  // ─── Condition & Details ─────────────────────────────────────
  @Prop({ enum: PropertyCondition }) condition?: PropertyCondition;
  @Prop({ min: 1800, max: 2100 }) yearBuilt?: number;
  @Prop() availableFrom?: Date;

  // ─── Amenities ───────────────────────────────────────────────
  @Prop({ default: false }) hasElevator!: boolean;
  @Prop({ default: false }) hasParking!: boolean;
  @Prop({ default: false }) hasGarden!: boolean;
  @Prop({ default: false }) hasBalcony!: boolean;
  @Prop({ default: false }) hasPool!: boolean;
  @Prop({ default: false }) hasTerrace!: boolean;
  @Prop({ default: false }) hasSeaView!: boolean;
  @Prop({ default: false }) hasCentralHeating!: boolean;
  @Prop({ default: false }) hasAirConditioning!: boolean;

  // ─── Location ────────────────────────────────────────────────
  @Prop() address?: string;
  @Prop() city?: string;
  @Prop() state?: string;
  @Prop() neighborhood?: string;
  @Prop() postalCode?: string;
  @Prop() lat?: number; // kept for backward compat
  @Prop() lng?: number; // kept for backward compat

  // GeoJSON Point — used for $near queries

  @Prop(raw({
    type: {
      type: String,
      enum: ['Point'],
    },
    coordinates: {
      type: [Number],
    },
  }))
  location?: { type: string; coordinates: number[] };
  // ─── Creator ─────────────────────────────────────────────────
  // Agent who entered the property on behalf of the owner
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  createdBy!: Types.ObjectId | null;

  // Branch ID — automatically set from the agent's branch
  @Prop({ type: String, default: null })
  branchId!: string | null;

  // Owner — must have a platform account to add their property
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  ownerId!: Types.ObjectId;

  // ─── Agency ──────────────────────────────────────────────────
  @Prop() agent_id?: string; // kept for backward compat

  // ─── Images (existing format kept) ───────────────────────────
  @Prop({
    type: [{ data: String, mimetype: String, name: String }],
    default: [],
  })
  images!: { data: string; mimetype: string; name: string }[];
}

export const PropertySchema = SchemaFactory.createForClass(Property);

// ─── Indexes ─────────────────────────────────────────────────────────────────
PropertySchema.index({ type: 1, propertyType: 1 });
PropertySchema.index({ city: 1, state: 1 });
PropertySchema.index({ status: 1 });
PropertySchema.index({ price: 1 });
PropertySchema.index({ createdBy: 1 });
PropertySchema.index({ ownerId: 1 });
PropertySchema.index({ location: '2dsphere' }, { sparse: true });
