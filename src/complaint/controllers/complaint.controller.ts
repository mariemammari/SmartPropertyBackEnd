import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { ComplaintService } from '../services/complaint.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guards';
import { Roles } from '../../auth/decorators/roles.decorator';
import {
  CreateComplaintDto,
  UpdateComplaintDto,
  AdminResponseDto,
  ResolveComplaintDto,
  ClientFeedbackDto,
} from '../dto/complaint.dto';
import { ComplaintStatus } from '../schemas/complaint.schema';

export enum UserRole {
  CLIENT = 'client',
  BRANCH_MANAGER = 'branch_manager',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
}

@Controller('complaints')
@UseGuards(JwtAuthGuard)
export class ComplaintController {
  constructor(private readonly complaintService: ComplaintService) {}

  // ─── Create Complaint ───────────────────────────────────────────────────
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateComplaintDto, @Request() req: any) {
    const userId = req.user.userId || req.user.id || req.user.sub;
    const complaint = await this.complaintService.create(dto, userId);
    return {
      message: 'Complaint created successfully',
      complaint,
    };
  }

  // ─── Get All Complaints ─────────────────────────────────────────────────
  // SUPER_ADMIN/ADMIN: sees all, BRANCH_MANAGER: sees branch only
  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER)
  async findAll(
    @Request() req: any,
    @Query('status') status?: ComplaintStatus,
    @Query('target') target?: string,
    @Query('priority') priority?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userRole = req.user.role;
    const userBranchId = req.user.branchId;

    // Branch manager can only see their branch complaints
    let branchFilter: string | undefined;
    if (userRole === UserRole.BRANCH_MANAGER) {
      if (!userBranchId) {
        throw new ForbiddenException(
          'Branch manager not assigned to any branch',
        );
      }
      branchFilter = userBranchId;
    }

    const result = await this.complaintService.findAll({
      status,
      target,
      priority,
      branchId: branchFilter,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });

    return {
      message: 'Complaints retrieved successfully',
      ...result,
    };
  }

  // ─── Get My Complaints (Client) ─────────────────────────────────────────
  @Get('my-complaints')
  async getMyComplaints(
    @Request() req: any,
    @Query('status') status?: ComplaintStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = req.user.userId || req.user.id || req.user.sub;
    const result = await this.complaintService.findByClient(userId, {
      status,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
    return {
      message: 'Your complaints retrieved successfully',
      ...result,
    };
  }

  // ─── Get Branch Complaints (Branch Manager Only) ─────────────────────────
  @Get('branch/my-branch')
  @UseGuards(RolesGuard)
  @Roles(UserRole.BRANCH_MANAGER)
  async getMyBranchComplaints(
    @Request() req: any,
    @Query('status') status?: ComplaintStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const branchId = req.user.branchId;
    if (!branchId) {
      throw new ForbiddenException('No branch assigned to your account');
    }

    const result = await this.complaintService.findAll({
      status,
      branchId,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });

    return {
      message: 'Branch complaints retrieved successfully',
      ...result,
    };
  }

  // ─── Get Single Complaint ───────────────────────────────────────────────

  @Get(':id')
  async getById(@Param('id') id: string, @Request() req: any) {
    const complaint = await this.complaintService.findById(id);

    const userRole = req.user.role;
    const userBranchId = req.user.branchId;

    // Check all possible ID locations from JWT strategy
    const possibleUserIds = [req.user.sub, req.user.id, req.user.userId].filter(
      Boolean,
    ); // remove undefined/null

    // Helper to safely compare IDs (handles ObjectId vs string)
    const idsMatch = (id1: any, id2: any): boolean => {
      if (!id1 || !id2) return false;
      const str1 = id1.toString ? id1.toString() : String(id1);
      const str2 = id2.toString ? id2.toString() : String(id2);
      return str1 === str2;
    };

    // Check if any of the user's IDs match the complaint's userId
    const isOwner = possibleUserIds.some((uid) =>
      idsMatch(complaint.userId, uid),
    );

    // Client can only see own complaints
    if (userRole === UserRole.CLIENT && !isOwner) {
      throw new ForbiddenException('You can only view your own complaints');
    }

    // Branch manager can only see their branch complaints
    if (userRole === UserRole.BRANCH_MANAGER) {
      const branchMatch = idsMatch(complaint.branchId, userBranchId);
      if (!branchMatch) {
        throw new ForbiddenException('This complaint is not in your branch');
      }
    }

    return {
      message: 'Complaint retrieved successfully',
      complaint,
    };
  }

  // ─── Update Complaint ──────────────────────────────────────────
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateComplaintDto,
    @Request() req: any,
  ) {
    const userId = req.user.userId || req.user.id || req.user.sub;
    const complaint = await this.complaintService.update(id, dto, userId);
    return {
      message: 'Complaint updated successfully',
      complaint,
    };
  }

  // ─── Admin/Manager Response ─────────────────────────────────────────────
  @Post(':id/response')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER)
  async addAdminResponse(
    @Param('id') id: string,
    @Body() dto: AdminResponseDto,
    @Request() req: any,
  ) {
    const adminId = req.user.userId || req.user.id || req.user.sub;
    const userRole = req.user.role;
    const userBranchId = req.user.branchId;

    // Branch manager can only respond to their branch complaints
    if (userRole === UserRole.BRANCH_MANAGER) {
      const complaint = await this.complaintService.findById(id);
      if (complaint.branchId?.toString() !== userBranchId) {
        throw new ForbiddenException(
          'You can only respond to complaints in your branch',
        );
      }
    }

    const complaint = await this.complaintService.addAdminResponse(
      id,
      dto,
      adminId,
    );
    return {
      message: 'Response added successfully',
      complaint,
    };
  }

  // ─── Resolve Complaint ──────────────────────────────────────────────────
  @Post(':id/resolve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER)
  async resolve(
    @Param('id') id: string,
    @Body() dto: ResolveComplaintDto,
    @Request() req: any,
  ) {
    const userRole = req.user.role;
    const userBranchId = req.user.branchId;

    // Branch manager can only resolve their branch complaints
    if (userRole === UserRole.BRANCH_MANAGER) {
      const complaint = await this.complaintService.findById(id);
      if (complaint.branchId?.toString() !== userBranchId) {
        throw new ForbiddenException(
          'You can only resolve complaints in your branch',
        );
      }
    }

    const complaint = await this.complaintService.resolve(id, dto);
    return {
      message: 'Complaint resolved successfully',
      complaint,
    };
  }

  // ─── Add Client Feedback ────────────────────────────────────────────────
  @Post(':id/feedback')
  async addFeedback(
    @Param('id') id: string,
    @Body() dto: ClientFeedbackDto,
    @Request() req: any,
  ) {
    const userId = req.user.userId || req.user.id || req.user.sub;
    const complaint = await this.complaintService.addClientFeedback(
      id,
      dto,
      userId,
    );
    return {
      message: 'Feedback added successfully',
      complaint,
    };
  }

  // ─── Mark as Read ──────────────────────────────────────────────────────
  @Post(':id/mark-read')
  async markAsRead(@Param('id') id: string, @Request() req: any) {
    const userId = req.user.userId || req.user.id || req.user.sub;
    const complaint = await this.complaintService.markAsRead(id, userId);
    return {
      message: 'Complaint marked as read',
      complaint,
    };
  }

  // ─── Delete Complaint ───────────────────────────────────────────────────
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string, @Request() req: any) {
    const userId = req.user.userId || req.user.id || req.user.sub;
    await this.complaintService.delete(id, userId);
  }

  // ─── Get Statistics ────────────────────────────────────────────────────
  @Get('admin/statistics')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER)
  async getStatistics(@Request() req: any) {
    const userRole = req.user.role;
    const userBranchId = req.user.branchId;

    // Branch manager only sees their branch stats
    let branchId: string | undefined;
    if (userRole === UserRole.BRANCH_MANAGER) {
      branchId = userBranchId;
    }

    const stats = await this.complaintService.getStatistics(branchId);
    return {
      message: 'Statistics retrieved successfully',
      statistics: stats,
    };
  }
}
