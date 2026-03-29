import {
  IsString, IsEnum, IsOptional, IsNumber,
  IsBoolean, IsMongoId, IsDate, Min, IsArray,
  ValidateNested, IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ListingStatus, FurnishingStatus, Standing, PaymentTerms,
} from '../schemas/property-listing.schema';

// ─── Nested DTOs ──────────────────────────────────────────────────────────────

export class ContractPoliciesDto {
  @IsNumber() @Min(1) @IsOptional() minDuration?: number;
  @IsNumber() @Min(0) @IsOptional() maxDuration?: number;
  @IsNumber() @Min(0) @IsOptional() noticePeriodDays?: number;
  @IsNumber() @Min(0) @IsOptional() depositMonths?: number;
  @IsBoolean() @IsOptional() guarantorRequired?: boolean;
  @IsBoolean() @IsOptional() petsAllowed?: boolean;
  @IsBoolean() @IsOptional() sublettingAllowed?: boolean;
}

export class HousePoliciesDto {
  @IsBoolean() @IsOptional() noSmoking?: boolean;
  @IsBoolean() @IsOptional() noPets?: boolean;
  @IsBoolean() @IsOptional() noParties?: boolean;
  @IsString() @IsOptional() quietHours?: string;
  @IsString() @IsOptional() visitorRules?: string;
  @IsString() @IsOptional() cleaningSchedule?: string;
}

export class SalePoliciesDto {
  @IsEnum(PaymentTerms) @IsOptional() paymentTerms?: PaymentTerms;
  @IsString() @IsOptional() installmentDetails?: string;
  @IsBoolean() @IsOptional() mortgageAssistance?: boolean;
  @Type(() => Date) @IsDate() @IsOptional() handoverDate?: Date;
  @IsArray() @IsString({ each: true }) @IsOptional() includedFixtures?: string[];
}

export class FeesDto {
  @IsNumber() @Min(0) @IsOptional() rentAmount?: number;
  @IsNumber() @Min(0) @IsOptional() depositAmount?: number;
  @IsNumber() @Min(0) @IsOptional() agencyFees?: number;
  @IsNumber() @Min(0) @IsOptional() commonCharges?: number;
  @IsBoolean() @IsOptional() billsIncluded?: boolean;
  @IsArray() @IsString({ each: true }) @IsOptional() billsDetails?: string[];
}

// ─── Create ───────────────────────────────────────────────────────────────────

export class CreatePropertyListingDto {
  @IsMongoId() propertyId: string;
  @IsMongoId() ownerId: string;
  @IsMongoId() createdBy: string;

  @IsMongoId() @IsOptional() agentId?: string;
  @IsMongoId() @IsOptional() branchId?: string;

  // ─── Pricing ───────────────────────────────────────────────
  @IsNumber() @Min(0) price: number;

  @IsNumber() @Min(0) @IsOptional() monthlyCharges?: number;
  @IsBoolean() @IsOptional() isPriceNegotiable?: boolean;
  @IsBoolean() @IsOptional() isPriceAIGenerated?: boolean;

  // ─── Details ───────────────────────────────────────────────
  @IsEnum(FurnishingStatus) @IsOptional() furnishingStatus?: FurnishingStatus;
  @IsEnum(Standing) @IsOptional() standing?: Standing;
  @IsBoolean() @IsOptional() wifiEthernet?: boolean;

  // ─── Status ────────────────────────────────────────────────
  @IsEnum(ListingStatus) @IsOptional() status?: ListingStatus;

  // ─── Policies (flat — no wrapper object) ───────────────────
  @ValidateNested() @Type(() => ContractPoliciesDto) @IsOptional()
  contractPolicies?: ContractPoliciesDto;

  @ValidateNested() @Type(() => HousePoliciesDto) @IsOptional()
  housePolicies?: HousePoliciesDto;

  @ValidateNested() @Type(() => SalePoliciesDto) @IsOptional()
  salePolicies?: SalePoliciesDto;

  // ─── Fees ──────────────────────────────────────────────────
  @ValidateNested() @Type(() => FeesDto) @IsOptional()
  fees?: FeesDto;

  // ─── Publishing ────────────────────────────────────────────
  @Type(() => Date) @IsDate() @IsOptional() expiresAt?: Date;

  // ─── Custom Fields ──────────────────────────────────────────
  @IsObject() @IsOptional() customFields?: Record<string, any>;
}

// ─── Update ───────────────────────────────────────────────────────────────────

export class UpdatePropertyListingDto {
  @IsNumber() @Min(0) @IsOptional() price?: number;
  @IsNumber() @Min(0) @IsOptional() monthlyCharges?: number;
  @IsBoolean() @IsOptional() isPriceNegotiable?: boolean;

  @IsEnum(ListingStatus) @IsOptional() status?: ListingStatus;
  @IsEnum(FurnishingStatus) @IsOptional() furnishingStatus?: FurnishingStatus;
  @IsEnum(Standing) @IsOptional() standing?: Standing;
  @IsBoolean() @IsOptional() wifiEthernet?: boolean;

  @IsMongoId() @IsOptional() agentId?: string;
  @IsMongoId() @IsOptional() branchId?: string;

  @IsString() @IsOptional() rejectionReason?: string;
  @IsArray() @IsString({ each: true }) @IsOptional() agentComments?: string[];

  @Type(() => Date) @IsDate() @IsOptional() expiresAt?: Date;

  @ValidateNested() @Type(() => ContractPoliciesDto) @IsOptional()
  contractPolicies?: ContractPoliciesDto;

  @ValidateNested() @Type(() => HousePoliciesDto) @IsOptional()
  housePolicies?: HousePoliciesDto;

  @ValidateNested() @Type(() => SalePoliciesDto) @IsOptional()
  salePolicies?: SalePoliciesDto;

  @ValidateNested() @Type(() => FeesDto) @IsOptional()
  fees?: FeesDto;

  // ─── Custom Fields ──────────────────────────────────────────
  @IsObject() @IsOptional() customFields?: Record<string, any>;
}

// ─── Filter ───────────────────────────────────────────────────────────────────

export class ListingFilterDto {
  @IsMongoId() @IsOptional() propertyId?: string;
  @IsMongoId() @IsOptional() ownerId?: string;
  @IsMongoId() @IsOptional() agentId?: string;
  @IsEnum(ListingStatus) @IsOptional() status?: ListingStatus;

  @IsNumber() @IsOptional() @Type(() => Number) page?: number;
  @IsNumber() @IsOptional() @Type(() => Number) limit?: number;
}