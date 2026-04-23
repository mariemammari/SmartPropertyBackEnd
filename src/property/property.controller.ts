
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PropertyService } from './property.service';
import {
  CreatePropertyDto,
  UpdatePropertyDto,
  PropertyFilterDto,
} from './dto/create-property.dto';
import { UserRole } from '../user/schemas/user.schema';

@UseGuards(JwtAuthGuard)
@Controller('properties')
export class PropertyController {
  constructor(private readonly propertiesService: PropertyService) {}

  // ── Create ────────────────────────────────────────────────────────────────
  @Post()
  create(@Body() dto: CreatePropertyDto, @Request() req) {
    console.log('req.user:', req.user); // log

    const { userId, role } = req.user;

    if (role === UserRole.REAL_ESTATE_AGENT) {
      // Agent creates on behalf of owner → ownerId comes from body, createdBy = agent
      dto.createdBy = userId;
    } else {
      // Owner creates himself → ownerId = himself
      dto.ownerId = userId;
      dto.createdBy = undefined;
    }

    return this.propertiesService.create(dto);
  }

  // ── Get All
  @Get()
  findAll(@Query() filters: PropertyFilterDto, @Request() req) {
    const { userId, role } = req.user;

    // Agent voit uniquement ses propriétés
    if (role === UserRole.REAL_ESTATE_AGENT) {
      filters.createdBy = userId;
    }

    return this.propertiesService.findAll(filters);
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  @Get('stats')
  getStats() {
    return this.propertiesService.getStats();
  }

  // ── My Properties (owner or agent) ────────────────────────────────────────
  @Get('mine')
  findMine(@Request() req) {
    const { userId, role } = req.user;
    if (role === UserRole.REAL_ESTATE_AGENT) {
      return this.propertiesService.findByAgent(userId);
    }
    return this.propertiesService.findByOwner(userId);
  }

  // ── Rented by Branch ──────────────────────────────────────────────────────
  @Get('rented/branch/:branchId')
  findRentedByBranch(@Param('branchId') branchId: string) {
    return this.propertiesService.findRentedByBranch(branchId);
  }

  // ── Rented by Agent ───────────────────────────────────────────────────────
  @Get('rented/agent/:agentId')
  findRentedByAgent(@Param('agentId') agentId: string) {
    return this.propertiesService.findRentedByAgent(agentId);
  }

  // ── Rented by Owner ───────────────────────────────────────────────────────
  @Get('rented/owner/:ownerId')
  findRentedByOwner(@Param('ownerId') ownerId: string) {
    return this.propertiesService.findRentedByOwner(ownerId);
  }

  // ── By Owner ──────────────────────────────────────────────────────────────
  @Get('owner/:ownerId')
  findByOwner(@Param('ownerId') ownerId: string) {
    return this.propertiesService.findByOwner(ownerId);
  }

  // ── By Agent ──────────────────────────────────────────────────────────────
  @Get('agent/:agentId')
  findByAgent(@Param('agentId') agentId: string) {
    return this.propertiesService.findByAgent(agentId);
  }

  // ── Get One ───────────────────────────────────────────────────────────────
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.propertiesService.findOne(id);
  }

  // ── Update ────────────────────────────────────────────────────────────────
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePropertyDto) {
    return this.propertiesService.update(id, dto);
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    console.log('🔴 DELETE ENDPOINT CALLED for property:', id);
    return this.propertiesService.remove(id);
  }
}
