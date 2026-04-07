import {
  IsString,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsArray,
  IsNumber,
  Min,
  Max,
  MinLength,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import {
  ComplaintTarget,
  ComplaintStatus,
  ComplaintPriority,
} from '../schemas/complaint.schema';
import { Transform } from 'class-transformer';

export class CreateComplaintDto {
  // propertyNumber is required when target is PROPERTY or LISTING
  @ValidateIf((o) =>
    [ComplaintTarget.PROPERTY, ComplaintTarget.LISTING].includes(o.target),
  )
  @IsString()
  propertyNumber?: string;
  @IsString()
  @MinLength(5)
  @MaxLength(100)
  subject: string;

  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  description: string;

  @IsEnum(ComplaintTarget)
  target: ComplaintTarget;

  // branchId is required when target is AGENT, PROPERTY, or LISTING
  @ValidateIf((o) =>
    [
      ComplaintTarget.AGENT,
      ComplaintTarget.PROPERTY,
      ComplaintTarget.LISTING,
    ].includes(o.target),
  )
  @IsMongoId()
  branchId: string;

  @IsOptional()
  @IsMongoId()
  @Transform(({ value }) => (value === '' ? undefined : value)) // <-- ADD THIS
  propertyId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsEnum(ComplaintPriority)
  priority?: ComplaintPriority = ComplaintPriority.MEDIUM;
}

export class UpdateComplaintDto {
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(100)
  subject?: string;

  @IsOptional()
  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsArray()
  attachments?: string[];

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsEnum(ComplaintPriority)
  priority?: ComplaintPriority;
}

export class AdminResponseDto {
  @IsString()
  @MinLength(10)
  adminNote: string;

  @IsOptional()
  @IsEnum(ComplaintStatus)
  status?: ComplaintStatus;

  @IsOptional()
  @IsMongoId()
  assignedTo?: string;
}

export class ResolveComplaintDto {
  @IsString()
  @MinLength(10)
  adminNote: string;

  @IsOptional()
  @IsEnum(ComplaintStatus)
  status?: ComplaintStatus;
}

export class ClientFeedbackDto {
  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  feedback?: string;
}
