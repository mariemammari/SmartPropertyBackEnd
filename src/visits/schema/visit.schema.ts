import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type VisitDocument = Visit & Document;

export enum VisitStatus {
  REQUESTED = 'REQUESTED',
  PROPOSED = 'PROPOSED',
  CONFIRMED = 'CONFIRMED',
  COMPLETED = 'COMPLETED',
  CANCELED = 'CANCELED',
  NO_SHOW = 'NO_SHOW',
}

@Schema({ timestamps: true })
export class Visit {
  @Prop({ type: Types.ObjectId, ref: 'Property', required: true })
  propertyId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  agentId?: Types.ObjectId;

  @Prop({ required: true })
  clientName!: string;

  @Prop({ required: true })
  clientPhone!: string;

  @Prop()
  clientEmail?: string;

  @Prop({ type: [Date], default: [] })
  requestedSlots!: Date[];

  @Prop()
  confirmedSlot?: Date;

  @Prop({
    type: String,
    enum: Object.values(VisitStatus),
    default: VisitStatus.REQUESTED,
  })
  status!: VisitStatus;

  @Prop()
  notes?: string;
}

export const VisitSchema = SchemaFactory.createForClass(Visit);