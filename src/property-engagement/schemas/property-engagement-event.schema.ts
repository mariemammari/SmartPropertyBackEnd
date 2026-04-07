import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PropertyEngagementEventDocument = PropertyEngagementEvent & Document;

export enum PropertyEngagementEventType {
  CLICK = 'CLICK',
  VIEW = 'VIEW',
  SAVE = 'SAVE',
}

@Schema({ timestamps: true, collection: 'property_engagement_events' })
export class PropertyEngagementEvent {
  @Prop({ type: Types.ObjectId, ref: 'Property', required: true, index: true })
  propertyId!: Types.ObjectId;

  @Prop({ type: String, required: true, index: true })
  userId!: string;

  @Prop({ type: String, enum: Object.values(PropertyEngagementEventType), required: true, index: true })
  eventType!: PropertyEngagementEventType;

  @Prop({ type: String, default: '' })
  role!: string;

  @Prop({ type: String, default: '' })
  pagePath!: string;

  @Prop({ type: String, default: '' })
  source!: string;

  @Prop({ type: String, default: '', index: true })
  propertyBranchId!: string;

  @Prop({ type: String, default: '', index: true })
  propertyCreatedById!: string;

  @Prop({ type: String, default: '' })
  propertyTitleSnapshot!: string;
}

export const PropertyEngagementEventSchema = SchemaFactory.createForClass(PropertyEngagementEvent);

PropertyEngagementEventSchema.index({ propertyId: 1, eventType: 1, createdAt: -1 });
PropertyEngagementEventSchema.index({ userId: 1, createdAt: -1 });
PropertyEngagementEventSchema.index({ propertyCreatedById: 1, createdAt: -1 });
PropertyEngagementEventSchema.index({ propertyBranchId: 1, createdAt: -1 });
