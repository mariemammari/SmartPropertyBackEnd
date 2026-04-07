import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BranchStatus = 'active' | 'inactive';

@Schema()
export class Branch extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  address: string;

  @Prop({ required: true })
  city: string;

  @Prop({ required: true })
  phone_number: string;

  @Prop({ required: true })
  email: string;

  @Prop({
    required: true,
    enum: ['active', 'inactive'],
    default: 'active',
  })
  status: BranchStatus;

  @Prop({ required: true })
  opening_time: string; // e.g., "09:00"

  @Prop({ required: true })
  closing_time: string; // e.g., "18:00"

  @Prop({ default: Date.now })
  created_at: Date;
}

export const BranchSchema = SchemaFactory.createForClass(Branch);
