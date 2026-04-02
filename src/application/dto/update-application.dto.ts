import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { ApplicationStatus, RejectionType } from '../schemas/application.schema';

export class UpdateApplicationDto {
  @IsEnum(ApplicationStatus)
  @IsNotEmpty()
  status: string;

  @ValidateIf((o) => o.status === ApplicationStatus.REJECTED)
  @IsEnum(RejectionType)
  @IsOptional()
  rejectionType?: string;

  @ValidateIf((o) => o.status === ApplicationStatus.REJECTED)
  @IsString()
  @MaxLength(500)
  @IsOptional()
  rejectionReason?: string;

  @ValidateIf((o) => o.status === ApplicationStatus.REJECTED || o.status === ApplicationStatus.REQUEST_MORE_DOCUMENTS)
  @IsArray()
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  @IsOptional()
  improveChecklist?: string[];
}
