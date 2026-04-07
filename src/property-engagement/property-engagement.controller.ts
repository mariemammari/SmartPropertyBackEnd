import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guards';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../user/schemas/user.schema';
import { PropertyEngagementService } from './property-engagement.service';

@UseGuards(JwtAuthGuard)
@Controller('property-engagement')
export class PropertyEngagementController {
  constructor(
    private readonly propertyEngagementService: PropertyEngagementService,
  ) {}

  @Post('events')
  async trackEvent(@Request() req: any, @Body() body: any) {
    return this.propertyEngagementService.trackEvent(req.user, body);
  }

  @Get('summary/agent')
  @UseGuards(RolesGuard)
  @Roles(UserRole.REAL_ESTATE_AGENT)
  async getAgentSummary(@Request() req: any) {
    return this.propertyEngagementService.getSummaryForScope('agent', req.user);
  }

  @Get('summary/branch')
  @UseGuards(RolesGuard)
  @Roles(UserRole.BRANCH_MANAGER)
  async getBranchSummary(@Request() req: any) {
    return this.propertyEngagementService.getSummaryForScope(
      'branch',
      req.user,
    );
  }

  @Get('summary/global')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async getGlobalSummary(@Request() req: any) {
    return this.propertyEngagementService.getSummaryForScope(
      'global',
      req.user,
    );
  }

  @Get('summary/property/:propertyId')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.REAL_ESTATE_AGENT,
    UserRole.BRANCH_MANAGER,
    UserRole.SUPER_ADMIN,
    UserRole.CLIENT,
  )
  async getPropertySummary(
    @Request() req: any,
    @Param('propertyId') propertyId: string,
  ) {
    return this.propertyEngagementService.getPropertySummary(
      propertyId,
      req.user,
    );
  }
}
