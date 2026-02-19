import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PropertyDocument = Property & Document;

@Schema({ timestamps: true })
export class Property {
  @Prop({ required: true })
  title: string;

  @Prop()
  description: string;

  @Prop({ required: true, enum: ['rent', 'sale'] })
  type: string;

  @Prop({ default: 'available', enum: ['available', 'rented', 'sold'] })
  status: string;

  @Prop({ required: true })
  price: number;

  @Prop()
  size: number;

  @Prop()
  rooms: number;

  @Prop()
  bathrooms: number;

  @Prop()
  address: string;

  @Prop()
  agent_id: string;
}

export const PropertySchema = SchemaFactory.createForClass(Property);
