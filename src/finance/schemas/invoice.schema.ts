import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type InvoiceDocument = Invoice & Document;

export enum InvoiceContractType {
  RENTAL = 'rental',
  SALE = 'sale',
}

@Schema({ _id: false })
class InvoicePaymentBreakdown {
  @Prop({ required: true, default: 0 })
  rentAmount: number;

  @Prop({ required: true, default: 0 })
  agencyFeeAmount: number;

  @Prop({ required: true, default: 0 })
  depositAmount: number;

  @Prop({ required: true, default: 1 })
  coveredMonths: number;
}

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
  subtotal: number; // HT

  @Prop({ required: false, default: 0 })
  htAmount?: number; // HT (même que subtotal pour compatibilité)

  @Prop({ required: false, default: 0 })
  vatAmount?: number;

  @Prop({ required: false, default: 19 })
  vatRate?: number;

  @Prop({ required: true })
  total: number; // TTC

  @Prop({ required: true })
  paid: number;

  @Prop({ required: true })
  balanceDue: number;

  @Prop({ default: 'pending' })
  status: string;

  @Prop({ required: false })
  signatureUrl?: string;

  @Prop({ required: false })
  pdfUrl?: string;

  @Prop({ required: false })
  pdfPublicId?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  accountantId: Types.ObjectId;

  @Prop({ enum: InvoiceContractType, required: false })
  contractType?: InvoiceContractType;

  @Prop({ type: Types.ObjectId, ref: 'RentalContract', required: false })
  rentalContractId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'SaleContract', required: false })
  saleContractId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Rental', required: false })
  rentalId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'RentalPayment', required: false })
  rentalPaymentId?: Types.ObjectId;

  @Prop({ required: false })
  paymentMethod?: string;

  @Prop({ required: false })
  billingPeriodStart?: Date;

  @Prop({ required: false })
  billingPeriodEnd?: Date;

  @Prop({ type: InvoicePaymentBreakdown, required: false })
  paymentBreakdown?: InvoicePaymentBreakdown;

  @Prop({ required: false })
  branchId?: string;

  @Prop({ required: false })
  notes?: string;
}

export const InvoiceSchema = SchemaFactory.createForClass(Invoice);
