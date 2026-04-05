import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { PropertySubmissionService } from './services/property-submission.service';
import { CreatePropertySubmissionDto } from './dto/create-property-submission.dto';
import {
  ApproveSubmissionDto,
  RejectSubmissionDto,
} from './dto/submission-review.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guards';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserDocument, UserRole } from '../user/schemas/user.schema';

/**
 * Property submission endpoints for client submissions and agent reviews.
 * All endpoints require authentication.
 */
@Controller('property-submissions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PropertySubmissionController {
  constructor(
    private readonly submissionService: PropertySubmissionService,
  ) {}

  /**
   * POST /property-submissions/client
   * Client submits a new property for review.
   * Request must include branchId.
   * Property status: inactive, Listing status: pending_review
   * Automatically assigned to least-loaded agent in branch.
   */
  @Post('client')
  @Roles(UserRole.CLIENT)
  async submitPropertyAsClient(
    @Body() dto: CreatePropertySubmissionDto,
    @CurrentUser() user: UserDocument,
  ) {
    const result = await this.submissionService.submitProperty(
      (user as any).userId?.toString() || (user as any)._id?.toString(),
      dto,
    );
    //hana ajouter ce log pour debug
    console.log('RESULT:', JSON.stringify(result, null, 2));


    return {
      success: true,
      listing: result.listing,
      warning: result.assignmentWarning,
      message: result.assignmentWarning
        ? 'Property submitted but could not be assigned to an agent'
        : 'Property submitted and assigned for review',
    };
  }

  /**
   * GET /property-submissions/assigned/pending
   * For agents: fetch their pending assigned submissions.
   */
  @Get('assigned/pending')
  @Roles(UserRole.REAL_ESTATE_AGENT)
  async getPendingForAgent(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @CurrentUser() user: UserDocument,
  ) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));

    const result = await this.submissionService.getAssignedPendingSubmissions(
      (user as any).userId?.toString() || (user as any)._id?.toString(),
      pageNum,
      limitNum,
    );

    return {
      success: true,
      ...result,
    };
  }

  /**
   * Backward-compatible endpoint for frontend integration.
   * GET /property-submissions?scope=agent&status=pending_review&page=1&limit=10
   */
  @Get()
  async listSubmissions(
    @Query('scope') scope?: string,
    @Query('status') status?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @CurrentUser() user?: UserDocument,
  ) {
    const role = (user as any)?.role;
    const userId = (user as any)?.userId?.toString() || (user as any)?._id?.toString();

    // Legacy frontend currently calls scope=agent
    if (scope === 'agent') {
      if (
        role !== UserRole.REAL_ESTATE_AGENT &&
        role !== UserRole.BRANCH_MANAGER &&
        role !== UserRole.SUPER_ADMIN
      ) {
        throw new ForbiddenException('Only agents/managers/admin can access agent scope submissions');
      }

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));

      const result = await this.submissionService.getAssignedPendingSubmissions(
        userId,
        pageNum,
        limitNum,
        status,
      );

      return {
        success: true,
        ...result,
      };
    }

    // Default fallback keeps behavior explicit for unsupported scopes.
    return {
      success: true,
      data: [],
      total: 0,
      page: 1,
      pages: 0,
      message: 'Unsupported scope. Use scope=agent.',
    };
  }

  /**
   * GET /property-submissions/:id
   * Fetch submission details by listing ID.
   * User must be the assigned agent, agent, or admin.
   */
  @Get(':id')
  @Roles(UserRole.REAL_ESTATE_AGENT, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN)
  async getSubmission(
    @Param('id') submissionId: string,
    @CurrentUser() user: UserDocument,
  ) {
    const submission =
      await this.submissionService.getSubmissionDetails(submissionId);

    // Authorization: agent or admin
    // TODO: Add proper authorization check based on user role/assignment
    // For now, assume all authenticated users can view submissions

    return {
      success: true,
      data: submission,
    };
  }

  /**
   * PATCH /property-submissions/:id/approve
   * Agent approves a submitted property.
   * Transitions listing.status to 'approved'
   * Transitions property.status to 'available'
   */
  @Patch(':id/approve')
  @Roles(UserRole.REAL_ESTATE_AGENT, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN)
  async approveSubmission(
    @Param('id') submissionId: string,
    @Body() dto: ApproveSubmissionDto,
    @CurrentUser() user: UserDocument,
  ) {
    const updated = await this.submissionService.approveSubmission(
      submissionId,
      (user as any).userId?.toString() || (user as any)._id?.toString(),
      dto,
    );

    return {
      success: true,
      message: 'Submission approved successfully',
      data: updated,
    };
  }

  /**
   * PATCH /property-submissions/:id/reject
   * Agent rejects a submitted property.
   * Transitions listing.status to 'rejected'
   * Property remains 'inactive'
   */
  @Patch(':id/reject')
  @Roles(UserRole.REAL_ESTATE_AGENT, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN)
  async rejectSubmission(
    @Param('id') submissionId: string,
    @Body() dto: RejectSubmissionDto,
    @CurrentUser() user: UserDocument,
  ) {
    const updated = await this.submissionService.rejectSubmission(
      submissionId,
      (user as any).userId?.toString() || (user as any)._id?.toString(),
      dto,
    );

    return {
      success: true,
      message: 'Submission rejected successfully',
      data: updated,
    };
  }
}
