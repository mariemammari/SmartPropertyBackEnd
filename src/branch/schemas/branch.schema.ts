import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type BranchDocument = HydratedDocument<Branch>;

@Schema({ timestamps: true })
export class Branch {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  location: string;

  @Prop()
  phone: string;

  @Prop({ default: true })
  Open: boolean;

  @Prop()
  branch_manager_id: string;

  @Prop()
  email: string;

  @Prop()
  open_time: string;

  @Prop()
  close_time: string;
}

export const BranchSchema = SchemaFactory.createForClass(Branch);