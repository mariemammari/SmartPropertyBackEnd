import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class UserPreference extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  budgetMin!: number;

  @Prop({ required: true })
  budgetMax!: number;

  @Prop({ required: true })
  preferredPropertyType!: string; // Ex: "Apartment"

  @Prop({ required: true })
  preferredCity!: string; // Ex: "Tunis"

  @Prop({ required: false, enum: ['rent', 'sale'] })
  preferredPurpose?: string;

  @Prop({ required: true })
  monthlyIncome!: number;
}

export const UserPreferenceSchema = SchemaFactory.createForClass(UserPreference);
