import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum RentalConversationType {
    AGENT_TENANT = 'agent_tenant',
    AGENT_OWNER = 'agent_owner',
}

export type RentalConversationDocument = RentalConversation & Document;

@Schema({ timestamps: true, collection: 'rental_conversations' })
export class RentalConversation {
    @Prop({ type: Types.ObjectId, ref: 'Rental', required: true })
    rentalId!: Types.ObjectId;

    @Prop({ enum: RentalConversationType, required: true })
    conversationType!: RentalConversationType;

    @Prop({ type: [Types.ObjectId], ref: 'User', required: true })
    participants!: Types.ObjectId[];

    @Prop({ type: Types.ObjectId, ref: 'RentalMessage' })
    lastMessage?: Types.ObjectId;

    @Prop()
    createdAt?: Date;

    @Prop()
    updatedAt?: Date;
}

export const RentalConversationSchema = SchemaFactory.createForClass(RentalConversation);

RentalConversationSchema.index({ rentalId: 1, conversationType: 1 });
RentalConversationSchema.index({ participants: 1 });