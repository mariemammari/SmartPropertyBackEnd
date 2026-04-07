import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PropertyListingDocument = PropertyListing & Document;

export enum ListingStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  ACTIVE = 'active',
  RENTED = 'rented',
  SOLD = 'sold',
  INACTIVE = 'inactive',
  REJECTED = 'rejected',
  ARCHIVED = 'archived',
}

export enum AssignmentStatus {
  ASSIGNED = 'assigned',
  UNASSIGNED = 'unassigned',
}

export enum FurnishingStatus {
  FURNISHED = 'furnished',
  PARTIALLY_FURNISHED = 'partially_furnished',
  UNFURNISHED = 'unfurnished',
}

export enum Standing {
  HAUT_STANDING = 'haut_standing',
  STANDING = 'standing',
  TRADITIONNEL = 'traditionnel',
  BAS_STANDING = 'bas_standing',
}

export enum PaymentTerms {
  CASH = 'cash',
  INSTALLMENT = 'installment',
  BANK_LOAN = 'bank_loan',
}

// ─── Nested Schemas ───────────────────────────────────────────────────────────

@Schema({ _id: false })
class ContractPolicies {
  @Prop({ min: 1 }) minDuration?: number;
  @Prop() maxDuration?: number;
  @Prop({ min: 0 }) noticePeriodDays?: number;
  @Prop({ min: 0 }) depositMonths?: number;
  @Prop({ default: false }) guarantorRequired!: boolean;
  @Prop({ default: false }) petsAllowed!: boolean;
  @Prop({ default: false }) sublettingAllowed!: boolean;
}
const ContractPoliciesSchema = SchemaFactory.createForClass(ContractPolicies);

@Schema({ _id: false })
class HousePolicies {
  @Prop({ default: false }) noSmoking!: boolean;
  @Prop({ default: false }) noPets!: boolean;
  @Prop({ default: false }) noParties!: boolean;
  @Prop() quietHours?: string;
  @Prop() visitorRules?: string;
  @Prop() cleaningSchedule?: string;
}
const HousePoliciesSchema = SchemaFactory.createForClass(HousePolicies);

@Schema({ _id: false })
class SalePolicies {
  @Prop({ enum: PaymentTerms }) paymentTerms?: PaymentTerms;
  @Prop() installmentDetails?: string;
  @Prop({ default: false }) mortgageAssistance!: boolean;
  @Prop() handoverDate?: Date;
  @Prop({ type: [String], default: [] }) includedFixtures!: string[];
}
const SalePoliciesSchema = SchemaFactory.createForClass(SalePolicies);

@Schema({ _id: false })
class Fees {
  @Prop({ min: 0 }) rentAmount?: number;
  @Prop({ min: 0 }) depositAmount?: number;
  @Prop({ min: 0 }) agencyFees?: number;
  @Prop({ min: 0 }) commonCharges?: number;
  @Prop({ default: false }) billsIncluded!: boolean;
  @Prop({ type: [String], default: [] }) billsDetails!: string[];
}
const FeesSchema = SchemaFactory.createForClass(Fees);

// ─── Main Schema ──────────────────────────────────────────────────────────────

@Schema({ timestamps: true, collection: 'property_listings' })
export class PropertyListing {
  @Prop({ type: Types.ObjectId, ref: 'Property', required: true })
  propertyId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  ownerId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy!: Types.ObjectId;

  // ─── Pricing ─────────────────────────────────────────────────
  @Prop({ required: true, min: 0 }) price!: number;
  @Prop({ default: false }) isPriceNegotiable!: boolean;
  @Prop({ default: false }) isPriceAIGenerated!: boolean;
  @Prop({ min: 0, default: 0 }) monthlyCharges!: number;

  // ─── Details ─────────────────────────────────────────────────
  @Prop({ enum: FurnishingStatus }) furnishingStatus?: FurnishingStatus;
  @Prop({ enum: Standing }) standing?: Standing;
  @Prop({ default: false }) wifiEthernet!: boolean;

  // ─── Status ──────────────────────────────────────────────────
  @Prop({ enum: ListingStatus, default: ListingStatus.DRAFT, index: true })
  status!: ListingStatus;

  // ─── Agency ──────────────────────────────────────────────────
  @Prop({ type: Types.ObjectId, ref: 'User' }) agentId?: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Branch' }) branchId?: Types.ObjectId;

  // ─── Review ──────────────────────────────────────────────────
  @Prop() submittedForReviewAt?: Date;
  @Prop() reviewedAt?: Date;
  @Prop({ type: Types.ObjectId, ref: 'User' }) reviewedBy?: Types.ObjectId;
  @Prop() rejectionReason?: string;
  @Prop({ type: [String], default: [] }) agentComments!: string[];

  // ─── Publishing ──────────────────────────────────────────────
  @Prop() publishedAt?: Date;
  @Prop() expiresAt?: Date;

  // ─── Reference Number ────────────────────────────────────────
  @Prop({ unique: true, sparse: true })
  referenceNumber!: string;

  // ─── Policies ────────────────────────────────────────────────
  @Prop({ type: ContractPoliciesSchema })
  contractPolicies?: ContractPolicies;

  @Prop({ type: HousePoliciesSchema })
  housePolicies?: HousePolicies;

  @Prop({ type: SalePoliciesSchema })
  salePolicies?: SalePolicies;

  // ─── Fees ─────────────────────────────────────────────────────
  @Prop({ type: FeesSchema })
  fees?: Fees;

  // ─── Custom Fields ────────────────────────────────────────────
  @Prop({ type: Object, default: {} })
  customFields!: Record<string, any>;

  // ─── Client Submission & Assignment ──────────────────────────
  @Prop({ default: false })
  submittedByClient!: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  assignedAgentId!: Types.ObjectId | null;

  @Prop({
    enum: AssignmentStatus,
    default: AssignmentStatus.UNASSIGNED,
  })
  assignmentStatus!: AssignmentStatus;

  @Prop({ type: Date, default: null })
  assignedAt!: Date | null;

  @Prop({ type: Date, default: null })
  lastAssignedAt!: Date | null;
}

export const PropertyListingSchema =
  SchemaFactory.createForClass(PropertyListing);

// ─── Indexes ─────────────────────────────────────────────────────────────────
PropertyListingSchema.index({ propertyId: 1 });
PropertyListingSchema.index({ status: 1, createdAt: -1 });
PropertyListingSchema.index({ agentId: 1, status: 1 });
PropertyListingSchema.index({ assignedAgentId: 1, status: 1 });
PropertyListingSchema.index({ assignmentStatus: 1, branchId: 1 });
PropertyListingSchema.index({ submittedByClient: 1, assignmentStatus: 1 });

// ─── Auto referenceNumber ─────────────────────────────────────────────────────
PropertyListingSchema.pre('save', function () {
  if (!this.referenceNumber) {
    const year = new Date().getFullYear();
    const suffix = this._id.toString().slice(-6).toUpperCase();
    this.referenceNumber = `SP-TUN-${year}-${suffix}`;
  }
});
