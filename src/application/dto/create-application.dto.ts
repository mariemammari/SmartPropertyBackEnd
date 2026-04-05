import { IsString, IsOptional, IsNumber, IsNotEmpty, IsBoolean, IsDateString } from 'class-validator';

export class CreateApplicationDto {
  @IsString()
  @IsNotEmpty()
  propertyId: string;

  @IsString()
  @IsNotEmpty()
  clientId: string;

  @IsString()
  @IsNotEmpty()
  agentId: string;

  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsNumber()
  @IsOptional()
  age?: number;

  @IsNumber()
  @IsOptional()
  familyMembers?: number;

  @IsString()
  @IsOptional()
  occupation?: string;

  @IsString()
  @IsOptional()
  employmentStatus?: string;

  @IsString()
  @IsOptional()
  employerName?: string;

  @IsNumber()
  @IsOptional()
  monthlyIncome?: number;

  @IsDateString()
  @IsOptional()
  preferredMoveInDate?: string;

  @IsNumber()
  @IsOptional()
  leaseDurationMonths?: number;

  @IsBoolean()
  @IsOptional()
  hasPets?: boolean;

  @IsString()
  @IsOptional()
  petsDetails?: string;

  @IsBoolean()
  @IsOptional()
  hasGuarantor?: boolean;

  @IsString()
  @IsOptional()
  guarantorName?: string;

  @IsString()
  @IsOptional()
  guarantorPhone?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  documentUrl?: string;
}
