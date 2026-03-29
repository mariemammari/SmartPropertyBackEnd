/* import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export enum PropertyType {
  RENT = 'rent',
  SALE = 'sale',
}

export enum PropertyStatus {
  AVAILABLE = 'available',
  RENTED = 'rented',
  SOLD = 'sold',
}

export class CreatePropertyDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(PropertyType)
  type: PropertyType;

  @IsNumber()
  price: number;

  @IsOptional()
  @IsNumber()
  size?: number;

  @IsOptional()
  @IsNumber()
  rooms?: number;

  @IsOptional()
  @IsNumber()
  bathrooms?: number;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  agent_id?: string;

  @IsOptional()
  @IsEnum(PropertyStatus)
  status?: PropertyStatus;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;
}
 */

import {
  IsString, IsEnum, IsOptional, IsNumber,
  IsBoolean, IsMongoId, IsDate, Min, Max,
  ValidateNested, IsObject, IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  TransactionType, PropertyType, PropertySubType,
  PropertyCondition, PropertyStatus,
} from '../schemas/property.schema';

export class CreatePropertyDto {
  // ─── Classification ──────────────────────────────────────────
  @IsEnum(PropertyType)
  propertyType: PropertyType;

  @IsEnum(PropertySubType)
  @IsOptional()
  propertySubType?: PropertySubType;

  @IsEnum(TransactionType)
  type: TransactionType;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  // ─── Pricing ─────────────────────────────────────────────────
  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  monthlyCharges?: number;

  @IsBoolean()
  @IsOptional()
  isPriceNegotiable?: boolean;

  @IsBoolean()
  @IsOptional()
  isPriceAIGenerated?: boolean;

  // ─── Surface & Rooms ─────────────────────────────────────────
  @IsNumber() @Min(0) @IsOptional() size?: number;
  @IsNumber() @Min(0) @IsOptional() rooms?: number;
  @IsNumber() @Min(0) @IsOptional() bedrooms?: number;
  @IsNumber() @Min(0) @IsOptional() bathrooms?: number;

  // ─── Floor ───────────────────────────────────────────────────
  @IsNumber() @Min(0) @IsOptional() floor?: number;
  @IsNumber() @Min(0) @IsOptional() totalFloors?: number;

  // ─── Condition ───────────────────────────────────────────────
  @IsEnum(PropertyCondition) @IsOptional() condition?: PropertyCondition;
  @IsEnum(PropertyStatus)
  @IsOptional()
  status?: PropertyStatus;
  @IsNumber() @Min(1800) @Max(2100) @IsOptional() yearBuilt?: number;

  @IsDate() @IsOptional() @Type(() => Date)
  availableFrom?: Date;

  // ─── Amenities ───────────────────────────────────────────────
  @IsBoolean() @IsOptional() hasElevator?: boolean;
  @IsBoolean() @IsOptional() hasParking?: boolean;
  @IsBoolean() @IsOptional() hasGarden?: boolean;
  @IsBoolean() @IsOptional() hasBalcony?: boolean;
  @IsBoolean() @IsOptional() hasPool?: boolean;
  @IsBoolean() @IsOptional() hasTerrace?: boolean;
  @IsBoolean() @IsOptional() hasSeaView?: boolean;
  @IsBoolean() @IsOptional() hasCentralHeating?: boolean;
  @IsBoolean() @IsOptional() hasAirConditioning?: boolean;

  // ─── Location ────────────────────────────────────────────────
  @IsString() @IsOptional() address?: string;
  @IsString() @IsOptional() city?: string;
  @IsString() @IsOptional() state?: string;
  @IsString() @IsOptional() neighborhood?: string;
  @IsString() @IsOptional() postalCode?: string;

  @IsNumber() @IsOptional() lat?: number;
  @IsNumber() @IsOptional() lng?: number;

  // ─── Creator ─────────────────────────────────────────────────
  @IsMongoId()
  @IsOptional()
  ownerId: string;

  @IsMongoId()
  @IsOptional()
  createdBy?: string; // agent — injected from JWT in service

  @IsString()
  @IsOptional()
  branchId?: string; // branch ID — automatically set from agent's branch

  // ─── Custom Fields ───────────────────────────────────────────
  @IsObject()
  @IsOptional()
  customFields?: Record<string, any>; // flexible key-value pairs
}

export class UpdatePropertyDto {
  @IsEnum(PropertyType) @IsOptional() propertyType?: PropertyType;
  @IsEnum(PropertySubType) @IsOptional() propertySubType?: PropertySubType;
  @IsEnum(TransactionType) @IsOptional() type?: TransactionType;
  @IsEnum(PropertyStatus)
  @IsOptional()
  status?: PropertyStatus;
  @IsEnum(PropertyCondition) @IsOptional() condition?: PropertyCondition;

  @IsString() @IsOptional() title?: string;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() branchId?: string; // branch ID
  @IsNumber() @Min(0) @IsOptional() price?: number;
  @IsNumber() @Min(0) @IsOptional() monthlyCharges?: number;
  @IsBoolean() @IsOptional() isPriceNegotiable?: boolean;
  @IsBoolean() @IsOptional() isPriceAIGenerated?: boolean;

  @IsNumber() @Min(0) @IsOptional() size?: number;
  @IsNumber() @Min(0) @IsOptional() rooms?: number;
  @IsNumber() @Min(0) @IsOptional() bedrooms?: number;
  @IsNumber() @Min(0) @IsOptional() bathrooms?: number;
  @IsNumber() @Min(0) @IsOptional() floor?: number;
  @IsNumber() @Min(0) @IsOptional() totalFloors?: number;

  @IsNumber() @Min(1800) @Max(2100) @IsOptional() yearBuilt?: number;
  @IsDate() @IsOptional() @Type(() => Date) availableFrom?: Date;

  @IsBoolean() @IsOptional() hasElevator?: boolean;
  @IsBoolean() @IsOptional() hasParking?: boolean;
  @IsBoolean() @IsOptional() hasGarden?: boolean;
  @IsBoolean() @IsOptional() hasBalcony?: boolean;
  @IsBoolean() @IsOptional() hasPool?: boolean;
  @IsBoolean() @IsOptional() hasTerrace?: boolean;
  @IsBoolean() @IsOptional() hasSeaView?: boolean;
  @IsBoolean() @IsOptional() hasCentralHeating?: boolean;
  @IsBoolean() @IsOptional() hasAirConditioning?: boolean;

  @IsString() @IsOptional() address?: string;
  @IsString() @IsOptional() city?: string;
  @IsString() @IsOptional() state?: string;
  @IsString() @IsOptional() neighborhood?: string;
  @IsString() @IsOptional() postalCode?: string;
  @IsNumber() @IsOptional() lat?: number;
  @IsNumber() @IsOptional() lng?: number;

  // ─── Custom Fields ───────────────────────────────────────────
  @IsObject()
  @IsOptional()
  customFields?: Record<string, any>; // flexible key-value pairs
}

export class PropertyFilterDto {
  @IsEnum(TransactionType) @IsOptional() type?: TransactionType;
  @IsEnum(PropertyType) @IsOptional() propertyType?: PropertyType;
  @IsEnum(PropertySubType) @IsOptional() propertySubType?: PropertySubType;
  @IsEnum(PropertyStatus) @IsOptional() status?: PropertyStatus;
  @IsEnum(PropertyCondition) @IsOptional() condition?: PropertyCondition;

  @IsString() @IsOptional() city?: string;
  @IsString() @IsOptional() state?: string;

  @IsNumber() @Min(0) @IsOptional() @Type(() => Number) minPrice?: number;
  @IsNumber() @Min(0) @IsOptional() @Type(() => Number) maxPrice?: number;
  @IsNumber() @Min(0) @IsOptional() @Type(() => Number) minSize?: number;
  @IsNumber() @Min(0) @IsOptional() @Type(() => Number) maxSize?: number;
  @IsNumber() @Min(0) @IsOptional() @Type(() => Number) bedrooms?: number;
  @IsNumber() @Min(0) @IsOptional() @Type(() => Number) bathrooms?: number;

  @IsBoolean() @IsOptional() hasParking?: boolean;
  @IsBoolean() @IsOptional() hasElevator?: boolean;
  @IsBoolean() @IsOptional() hasPool?: boolean;
  @IsBoolean() @IsOptional() hasAirConditioning?: boolean;

  @IsNumber() @IsOptional() @Type(() => Number) page?: number;
  @IsNumber() @IsOptional() @Type(() => Number) limit?: number;

  @IsMongoId() @IsOptional() ownerId?: string;
  @IsMongoId() @IsOptional() createdBy?: string;
}
