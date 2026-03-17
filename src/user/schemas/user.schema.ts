import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  BRANCH_MANAGER = 'branch_manager',
  ACCOUNTANT = 'accountant',
  REAL_ESTATE_AGENT = 'real_estate_agent',
  RENTAL_MANAGER = 'rental_manager',
  PROPERTY_OWNER = 'property_owner',
  TENANT = 'tenant',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true })
  fullName: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  phone: string;

  @Prop({ required: false })
  password?: string;

  @Prop({ required: false })
  googleId?: string;

  @Prop({ required: false })
  facebookId?: string;

  @Prop({ required: false })
  resetPasswordToken?: string;

  @Prop({ required: false })
  resetPasswordExpires?: Date;

  @Prop({ type: [String], default: [] })
  properties: string[];

  @Prop({
    type: String,
    enum: Object.values(UserRole),
    default: UserRole.TENANT,
  })
  role: UserRole;

  @Prop({ type: [String], default: [] })
  documents: string[];

  @Prop({ type: String, default: '' })
  Ai_riskScore: string;

  @Prop({ type: [String], default: [] })
  managedProperties: string[];

  @Prop({ type: [String], default: [] })
  savedProperties: string[];

  @Prop({
    type: String,
    enum: Object.values(UserStatus),
    default: UserStatus.ACTIVE,
  })
  status: UserStatus;

  @Prop({ default: '' })
  photo: string;

  @Prop({
    type: [{
      credentialID: String,
      publicKey: String,
      counter: Number,
      transports: [String],
      createdAt: { type: Date, default: Date.now }
    }],
    default: [],
  })
  webauthnCredentials: {
    credentialID: string;
    publicKey: string;
    counter: number;
    transports?: string[];
    createdAt?: Date;
  }[];

  @Prop({ required: false })
  currentWebAuthnChallenge?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

