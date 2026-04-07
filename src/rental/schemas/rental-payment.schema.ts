import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RentalPaymentDocument = RentalPayment & Document;

export enum RentalPaymentStatus {
    PENDING = 'pending',
    SUCCEEDED = 'succeeded',
    FAILED = 'failed',
    VERIFIED = 'verified',
}

export enum RentalPaymentMethod {
    STRIPE = 'stripe',
    CASH = 'cash',
    CHEQUE = 'cheque',
}

@Schema({ timestamps: true, collection: 'rental_payments' })
export class RentalPayment {
    @Prop({ type: Types.ObjectId, ref: 'Rental', required: true })
    rentalId!: Types.ObjectId;

    @Prop({ required: true, min: 0 })
    amount!: number;

    @Prop({ min: 0, default: 0 })
    rentAmount?: number;

    @Prop({ min: 0, default: 0 })
    agencyFeeAmount?: number;

    @Prop({ min: 0, default: 0 })
    depositAmount?: number;

    @Prop({ min: 0, default: 0 })
    totalDueForPeriod?: number;

    @Prop({ default: false })
    isInitialPaymentPeriod?: boolean;

    @Prop({ min: 1, default: 1 })
    coveredMonths?: number;

    @Prop({ default: 'eur' })
    currency!: string;

    @Prop({ enum: RentalPaymentMethod, default: RentalPaymentMethod.STRIPE, required: true })
    paymentMethod!: RentalPaymentMethod;

    @Prop()
    paymentMethodNote?: string;

    @Prop()
    stripePaymentIntentId?: string;

    @Prop()
    stripeChargeId?: string;

    @Prop({ enum: RentalPaymentStatus, default: RentalPaymentStatus.PENDING })
    status!: RentalPaymentStatus;

    @Prop()
    chequeNumber?: string;

    @Prop()
    chequeDate?: Date;

    @Prop()
    bankName?: string;

    @Prop()
    paymentProofUrl?: string;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    verifiedBy?: Types.ObjectId;

    @Prop()
    verifiedAt?: Date;

    @Prop({ type: Types.ObjectId, ref: 'Invoice' })
    invoiceId?: Types.ObjectId;

    @Prop()
    paidAt?: Date;

    // ─── BILLING PERIOD TRACKING ─────────────────────────────────────
    @Prop({ required: true })
    billingPeriodStart!: Date;  // Start of the month(s) this payment covers

    @Prop({ required: true })
    billingPeriodEnd!: Date;    // End of the month(s) this payment covers

    @Prop({ default: 1 })
    trancheNumber?: number;     // For multi-tranche payments: 1, 2, 3...

    @Prop({ default: false })
    isMultiMonth?: boolean;     // True if this payment covers 5+ months (bulk payment)

    @Prop()
    createdAt?: Date;

    @Prop()
    updatedAt?: Date;
}

export const RentalPaymentSchema = SchemaFactory.createForClass(RentalPayment);

RentalPaymentSchema.index({ rentalId: 1, status: 1 });
RentalPaymentSchema.index(
    { stripePaymentIntentId: 1 },
    {
        unique: true,
        partialFilterExpression: { stripePaymentIntentId: { $exists: true, $type: 'string' } },
    },
);
