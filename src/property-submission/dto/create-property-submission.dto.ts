import {
  IsString,
  IsNumber,
  IsOptional,
  IsMongoId,
  IsEnum,
  Min,
  IsBoolean,
  ValidateNested,
  IsObject,
  IsArray,
  IsDate,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  FurnishingStatus,
  Standing,
} from '../../property-listing/schemas/property-listing.schema';
import {
  PropertyCondition,
  PropertySubType,
  PropertyType,
  TransactionType,
} from '../../property/schemas/property.schema';
import {
  ContractPoliciesDto,
  FeesDto,
  HousePoliciesDto,
  SalePoliciesDto,
} from '../../property-listing/dto/Property-listing.dto';

/**
 * DTO for client property submission.
 * Creates both a Property and a PropertyListing, auto-assigns to agent.
 */
export class CreatePropertySubmissionDto {
  // ─── Branch & Metadata ────────────────────────────────────────
  @IsMongoId()
  branchId!: string; // REQUIRED: client must provide branch

  // ─── Property Details ─────────────────────────────────────────
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(PropertyType)
  propertyType!: PropertyType;

  @IsEnum(PropertySubType)
  @IsOptional()
  propertySubType?: PropertySubType;

  @IsEnum(TransactionType)
  type!: TransactionType;

  // ─── Pricing ──────────────────────────────────────────────────
  @IsNumber()
  @Min(0)
  price!: number;

  @IsBoolean()
  @IsOptional()
  isPriceNegotiable?: boolean;

  @IsNumber()
  @Min(0)
  @IsOptional()
  monthlyCharges?: number;

  // ─── Surface & Rooms ──────────────────────────────────────────
  @IsNumber()
  @Min(0)
  @IsOptional()
  size?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  rooms?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  bedrooms?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  bathrooms?: number;

  // ─── Floor ────────────────────────────────────────────────────
  @IsNumber()
  @IsOptional()
  floor?: number | null;

  @IsNumber()
  @Min(0)
  @IsOptional()
  totalFloors?: number;

  // ─── Condition & Details ──────────────────────────────────────
  @IsEnum(PropertyCondition)
  @IsOptional()
  condition?: PropertyCondition;

  @IsNumber()
  @Min(1800)
  @IsOptional()
  yearBuilt?: number;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  availableFrom?: Date;

  // ─── Amenities ──────────────────────────────────────────────────
  @IsBoolean()
  @IsOptional()
  hasElevator?: boolean;

  @IsBoolean()
  @IsOptional()
  hasParking?: boolean;

  @IsBoolean()
  @IsOptional()
  hasGarden?: boolean;

  @IsBoolean()
  @IsOptional()
  hasBalcony?: boolean;

  @IsBoolean()
  @IsOptional()
  hasPool?: boolean;

  @IsBoolean()
  @IsOptional()
  hasTerrace?: boolean;

  @IsBoolean()
  @IsOptional()
  hasSeaView?: boolean;

  @IsBoolean()
  @IsOptional()
  hasCentralHeating?: boolean;

  @IsBoolean()
  @IsOptional()
  hasAirConditioning?: boolean;

  // ─── Location ─────────────────────────────────────────────────
  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  neighborhood?: string;

  @IsString()
  @IsOptional()
  postalCode?: string;

  @IsNumber()
  @IsOptional()
  lat?: number;

  @IsNumber()
  @IsOptional()
  lng?: number;

  // ─── Listing Details ──────────────────────────────────────────
  @IsEnum(FurnishingStatus)
  @IsOptional()
  furnishingStatus?: FurnishingStatus;

  @IsEnum(Standing)
  @IsOptional()
  standing?: Standing;

  @IsBoolean()
  @IsOptional()
  wifiEthernet?: boolean;

  // ─── Policies ─────────────────────────────────────────────────
  @ValidateNested()
  @Type(() => ContractPoliciesDto)
  @IsOptional()
  contractPolicies?: ContractPoliciesDto;

  @ValidateNested()
  @Type(() => HousePoliciesDto)
  @IsOptional()
  housePolicies?: HousePoliciesDto;

  @ValidateNested()
  @Type(() => SalePoliciesDto)
  @IsOptional()
  salePolicies?: SalePoliciesDto;

  // ─── Fees ─────────────────────────────────────────────────────
  @ValidateNested()
  @Type(() => FeesDto)
  @IsOptional()
  fees?: FeesDto;

  // ─── Custom Fields ────────────────────────────────────────────
  @IsObject()
  @IsOptional()
  customFields?: Record<string, any>;

  // ─── 3D Photo ────────────────────────────────────────────────
  @IsString()
  @IsOptional()
  photo3D?: string;
}
