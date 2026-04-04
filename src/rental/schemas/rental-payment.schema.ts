import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RentalPaymentDocument = RentalPayment & Document;

export enum RentalPaymentStatus {
    PENDING = 'pending',
    SUCCEEDED = 'succeeded',
    FAILED = 'failed',
}

@Schema({ timestamps: true, collection: 'rental_payments' })
export class RentalPayment {
    @Prop({ type: Types.ObjectId, ref: 'Rental', required: true })
    rentalId!: Types.ObjectId;

    @Prop({ required: true, min: 0 })
    amount!: number;

    @Prop({ default: 'tnd' })
    currency!: string;

    @Prop({ required: true })
    stripePaymentIntentId!: string;

    @Prop()
    stripeChargeId?: string;

    @Prop({ enum: RentalPaymentStatus, default: RentalPaymentStatus.PENDING })
    status!: RentalPaymentStatus;

    @Prop()
    paidAt?: Date;
}

export const RentalPaymentSchema = SchemaFactory.createForClass(RentalPayment);

RentalPaymentSchema.index({ rentalId: 1, status: 1 });
RentalPaymentSchema.index({ stripePaymentIntentId: 1 }, { unique: true });
