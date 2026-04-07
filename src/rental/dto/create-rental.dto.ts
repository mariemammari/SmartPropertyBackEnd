import {
  IsBoolean,
  IsDate,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRentalDto {
  @IsMongoId() @IsNotEmpty() propertyId!: string;
  @IsMongoId() @IsNotEmpty() propertyListingId!: string;
  @IsMongoId() @IsNotEmpty() ownerId!: string;
  @IsMongoId() @IsNotEmpty() tenantId!: string;

  @IsMongoId() @IsOptional() agentId?: string;
  @IsString() @IsOptional() branchId?: string;

  @IsNumber() @Min(1) @IsOptional() durationMonths?: number;
  @IsBoolean() @IsOptional() autoRenew?: boolean;
  @IsNumber() @Min(0) @IsOptional() noticePeriodDays?: number;

  @Type(() => Date) @IsDate() @IsOptional() contractSignedAt?: Date;
  @Type(() => Date) @IsDate() @IsOptional() moveInDate?: Date;
  @Type(() => Date) @IsDate() @IsOptional() moveOutDate?: Date;

  @Type(() => Date) @IsDate() @IsOptional() lastPaymentDate?: Date;
  @Type(() => Date) @IsDate() @IsOptional() nextPaymentDue?: Date;

  @IsNumber() @Min(0) @IsOptional() outstandingBalance?: number;
  @IsNumber() @Min(1) @IsOptional() paymentFrequencyMonths?: number;

  @IsString() @IsOptional() notes?: string;
}
