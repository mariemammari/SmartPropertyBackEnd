import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ConversationDocument = Conversation & Document;

@Schema({ timestamps: true })
export class Conversation {
  @Prop({ type: [{ type: String, ref: 'User' }], required: true })
  participants: string[];

  @Prop({ type: String, ref: 'Message' })
  lastMessage: string;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);
