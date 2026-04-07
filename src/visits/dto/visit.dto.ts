import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsArray,
  IsDateString,
  IsMongoId,
} from 'class-validator';
import { VisitStatus } from '../schema/visit.schema';
export class CreateVisitDto {
  @IsMongoId()
  propertyId: string;

  @IsMongoId()
  @IsOptional()
  agentId?: string;

  @IsString()
  clientName: string;

  @IsString()
  clientPhone: string;

  @IsEmail()
  @IsOptional()
  clientEmail?: string;

  @IsArray()
  @IsDateString({}, { each: true })
  @IsOptional()
  requestedSlots?: string[];

  @IsDateString()
  @IsOptional()
  confirmedSlot?: string;

  @IsEnum(VisitStatus)
  @IsOptional()
  status?: VisitStatus;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateVisitDto {
  @IsEnum(VisitStatus)
  @IsOptional()
  status?: VisitStatus;

  @IsArray()
  @IsDateString({}, { each: true })
  @IsOptional()
  requestedSlots?: string[];

  @IsDateString()
  @IsOptional()
  confirmedSlot?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  clientName?: string;

  @IsString()
  @IsOptional()
  clientPhone?: string;

  @IsEmail()
  @IsOptional()
  clientEmail?: string;
}
