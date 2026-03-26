import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PropertyMediaDocument = PropertyMedia & Document;

export enum MediaTag {
  EXTERIOR    = 'exterior',
  LIVING_ROOM = 'living_room',
  BEDROOM     = 'bedroom',
  KITCHEN     = 'kitchen',
  BATHROOM    = 'bathroom',
  BALCONY     = 'balcony',
  GARDEN      = 'garden',
  PARKING     = 'parking',
  POOL        = 'pool',
  OTHER       = 'other',
}

@Schema({ timestamps: true, collection: 'property_media' })
export class PropertyMedia {

  @Prop({ type: Types.ObjectId, ref: 'Property', required: true, index: true })
  propertyId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'PropertyListing', index: true })
  listingId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  uploadedBy: Types.ObjectId;

  // ─── File ─────────────────────────────────────────────────────
  @Prop({ required: true }) url:      string;
  @Prop()                   publicId: string;

  @Prop({ enum: MediaTag, default: MediaTag.OTHER })
  tag: MediaTag;

  // ─── Display ──────────────────────────────────────────────────
  @Prop({ default: 0, min: 0 }) order:     number;
  @Prop({ default: false })     isPrimary: boolean;

  // ─── Dimensions ───────────────────────────────────────────────
  @Prop({ min: 0 }) width:  number;
  @Prop({ min: 0 }) height: number;
  @Prop({ min: 0 }) sizeKb: number;

  // ─── Soft delete ──────────────────────────────────────────────
  @Prop({ default: false }) isDeleted: boolean;
  @Prop()                   deletedAt: Date;
}

export const PropertyMediaSchema = SchemaFactory.createForClass(PropertyMedia);

PropertyMediaSchema.index({ propertyId: 1, order: 1 });
PropertyMediaSchema.index({ listingId: 1, isPrimary: -1 });
PropertyMediaSchema.index({ isDeleted: 1 });

PropertyMediaSchema.pre('save', async function () {
  if (this.isPrimary && this.isModified('isPrimary')) {
    const model = this.constructor as any;
    await model.updateMany(
      { listingId: this.listingId, _id: { $ne: this._id } },
      { $set: { isPrimary: false } },
    );
  }
});