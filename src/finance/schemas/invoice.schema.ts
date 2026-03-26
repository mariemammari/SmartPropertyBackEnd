import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type InvoiceDocument = Invoice & Document;

@Schema({ _id: false })
class InvoiceItem {
  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  quantity: number;

  @Prop({ required: true })
  rate: number;

  @Prop({ required: true })
  amount: number;
}

@Schema({ timestamps: true })
export class Invoice {
  @Prop({ required: true, unique: true })
  invoiceNumber: string;

  @Prop({ required: true })
  clientName: string;

  @Prop({ required: true })
  clientAddress: string;

  @Prop({ required: true })
  date: Date;

  @Prop({ required: true })
  dueDate: Date;

  @Prop({ type: [InvoiceItem], required: true })
  items: InvoiceItem[];

  @Prop({ required: true })
  subtotal: number;  // HT

  @Prop({ required: false, default: 0 })
  htAmount?: number;  // HT (même que subtotal pour compatibilité)

  @Prop({ required: false, default: 0 })
  vatAmount?: number;

  @Prop({ required: false, default: 19 })
  vatRate?: number;

  @Prop({ required: true })
  total: number;  // TTC

  @Prop({ required: true })
  paid: number;

  @Prop({ required: true })
  balanceDue: number;

  @Prop({ default: 'pending' })
  status: string;

  @Prop({ required: false })
  signatureUrl?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  accountantId: Types.ObjectId;

  @Prop({ required: false })
  branchId?: string;

  @Prop({ required: false })
  notes?: string;
}

export const InvoiceSchema = SchemaFactory.createForClass(Invoice);
