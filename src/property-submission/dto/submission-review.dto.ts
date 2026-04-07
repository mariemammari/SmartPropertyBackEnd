import { IsMongoId, IsOptional, IsString, IsEnum } from 'class-validator';
import { ListingStatus } from '../../property-listing/schemas/property-listing.schema';

/**
 * DTO for agent approval of a pending submission.
 */
export class ApproveSubmissionDto {
  @IsString()
  @IsOptional()
  agentComments?: string;
}

/**
 * DTO for agent rejection of a pending submission.
 */
export class RejectSubmissionDto {
  @IsString()
  rejectionReason: string;

  @IsString()
  @IsOptional()
  agentComments?: string;
}

/**
 * Filter DTO for fetching pending submissions assigned to an agent.
 */
export class FetchAssignedSubmissionsDto {
  @IsEnum(['pending_review', 'under_review'])
  @IsOptional()
  status?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}
