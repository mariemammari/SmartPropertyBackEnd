import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum MessageVisibility {
    ALL = 'all',           // all participants can see
    AGENT_ONLY = 'agent_only',       // only agent can see
    TENANT_ONLY = 'tenant_only',     // only tenant can see
    OWNER_ONLY = 'owner_only',       // only owner can see
}

export type RentalMessageDocument = RentalMessage & Document;

@Schema({ timestamps: true, collection: 'rental_messages' })
export class RentalMessage {
    @Prop({ type: Types.ObjectId, ref: 'RentalConversation', required: true })
    conversationId!: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    senderId!: Types.ObjectId;

    @Prop({ required: true })
    content!: string;

    @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
    readBy!: Types.ObjectId[];

    @Prop({ enum: MessageVisibility, default: MessageVisibility.ALL })
    visibleTo!: MessageVisibility;

    @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
    visibleToUsers?: Types.ObjectId[];  // explicit list of user IDs who can see this

    @Prop()
    createdAt?: Date;

    @Prop()
    updatedAt?: Date;
}

export const RentalMessageSchema = SchemaFactory.createForClass(RentalMessage);

RentalMessageSchema.index({ conversationId: 1, createdAt: 1 });

