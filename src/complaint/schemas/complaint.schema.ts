import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ComplaintDocument = Complaint & Document;

export enum ComplaintTarget {
  PROPERTY = 'property',
  AGENT = 'agent',
  PLATFORM = 'platform',
  LISTING = 'listing',
  OTHER = 'other',
}

export enum ComplaintStatus {
  OPEN = 'open',
  IN_REVIEW = 'in_review',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
  REJECTED = 'rejected',
}

export enum ComplaintPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

@Schema({ timestamps: true })
export class Complaint {
  // ─── Identity ───────────────────────────────────────────────────────────
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  // ─── Content ────────────────────────────────────────────────────────────
  @Prop({ required: true, trim: true, minlength: 5, maxlength: 100 })
  subject: string;

  @Prop({ required: true, minlength: 20, maxlength: 2000 })
  description: string;

  @Prop({ type: [String], default: [] })
  attachments: string[];

  @Prop({ type: [String], default: [] })
  tags: string[];

  // ─── Target & Routing ───────────────────────────────────────────────────
  @Prop({ required: true, enum: ComplaintTarget })
  target: ComplaintTarget;

  // For property/listing complaints
  @Prop({ type: Types.ObjectId, ref: 'PropertyCore', required: false })
  propertyId?: Types.ObjectId;

  // For agent complaints - route to branch
  @Prop({ type: Types.ObjectId, ref: 'Branch', required: false })
  branchId?: Types.ObjectId;

  // ─── Status & Priority ──────────────────────────────────────────────────
  @Prop({
    required: true,
    enum: ComplaintStatus,
    default: ComplaintStatus.OPEN,
  })
  status: ComplaintStatus;

  @Prop({
    required: false,
    enum: ComplaintPriority,
    default: ComplaintPriority.MEDIUM,
  })
  priority?: ComplaintPriority;

  // ─── Assignment ─────────────────────────────────────────────────────────
  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  assignedTo?: Types.ObjectId; // Branch manager or admin assigned to handle

  @Prop({ required: false })
  adminNote?: string;

  @Prop({ required: false })
  resolvedAt?: Date;

  // ─── Client Feedback ────────────────────────────────────────────────────
  @Prop({ required: false, min: 1, max: 5 })
  rating?: number;

  @Prop({ required: false })
  clientFeedback?: string;

  // ─── Notifications ──────────────────────────────────────────────────────
  @Prop({ required: true, default: false })
  isRead: boolean;

  @Prop({ required: true, default: false })
  notificationSent: boolean;
}

export const ComplaintSchema = SchemaFactory.createForClass(Complaint);

// Indexes
ComplaintSchema.index({ userId: 1, createdAt: -1 });
ComplaintSchema.index({ branchId: 1, status: 1 }); // NEW: For branch manager queries
ComplaintSchema.index({ target: 1, branchId: 1 }); // NEW: For agent complaint routing
ComplaintSchema.index({ status: 1 });
ComplaintSchema.index({ priority: 1 });
ComplaintSchema.index({ assignedTo: 1 });
