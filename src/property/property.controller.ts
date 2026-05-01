/* import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseInterceptors, UploadedFiles, UseGuards, Request, NotFoundException } from '@nestjs/common';
import { PropertyService } from './property.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { FilesInterceptor } from '@nestjs/platform-express/multer';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserService } from '../user/user.service';

@Controller('properties')
export class PropertyController {
    constructor(
        private readonly propertyService: PropertyService,
        private readonly userService: UserService,
    ) { }

    @Post()
    @UseGuards(JwtAuthGuard)
    async create(@Request() req, @Body() createPropertyDto: CreatePropertyDto) {
        // Get authenticated agent's info
        const agentId = req.user.userId || req.user._id || req.user.sub;
        const agent = await this.userService.findById(agentId);
        
        if (!agent) {
            throw new NotFoundException('Agent not found');
        }

        // Add agent's branchId to the property
        if (agent.branchId) {
            createPropertyDto.branchId = agent.branchId;
        }

        return this.propertyService.create(createPropertyDto);

    }

    @Get()
    findAll() {
        return this.propertyService.findAll();
    }


    // Search / Filter
    @Get('search')
    search(@Query() query: any) {
        // query =type, status, priceMin, priceMax, roomsMin, roomsMax, sizeMin, sizeMax, city, sortBy, order, page, limit

        return this.propertyService.findWithFilters(query);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.propertyService.findOne(id);
    }

    @Patch(':id')
    update(
        @Param('id') id: string,
        @Body() updatePropertyDto: UpdatePropertyDto,
    ) {
        return this.propertyService.update(id, updatePropertyDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.propertyService.remove(id);
    }


    @Post(':id/images')
    @UseInterceptors(FilesInterceptor('files', 10, { storage: memoryStorage() }))
    async uploadImages(
        @Param('id') id: string,
        @UploadedFiles() files: Express.Multer.File[]
    ) {
        return this.propertyService.uploadImages(id, files);
    }
    

}
 */
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
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { PropertyService } from './property.service';
import {
  CreatePropertyDto,
  UpdatePropertyDto,
  PropertyFilterDto,
} from './dto/create-property.dto';
import { UserRole } from '../user/schemas/user.schema';
import { NearbyService, NearbyResponse } from '../nearby/nearby.service';
import { NearbyQueryDto } from '../nearby/nearby.dto';

@Controller('properties')
export class PropertyController {
  constructor(
    private readonly propertiesService: PropertyService,
    private readonly nearbyService: NearbyService,
  ) { }

  // ── Create ────────────────────────────────────────────────────────────────
  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreatePropertyDto, @Request() req) {
    console.log('req.user:', req.user); // log

    const userId = req.user?.userId;
    const role = req.user?.role;

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
  @UseGuards(OptionalJwtAuthGuard)
  async findAll(@Query() filters: PropertyFilterDto, @Request() req) {
    const userId = req.user?.userId;
    const role = req.user?.role;

    // Agent voit uniquement ses propriétés
    if (role === UserRole.REAL_ESTATE_AGENT) {
      filters.createdBy = userId;
    }

    const result = await this.propertiesService.findAll(filters);
    const properties = result?.data || [];

    if (!req.user) {
      const masked = (properties || []).map((p: any) => {
        const obj = p?.toObject ? p.toObject() : p;
        return {
          id: obj.id || obj._id,
          title: obj.title,
          city: obj.city,
          price: obj.price,
        };
      });
      return { ...result, data: masked };
    }

    return result;
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  @Get('stats')
  @UseGuards(OptionalJwtAuthGuard)
  getStats() {
    return this.propertiesService.getStats();
  }

  // ── My Properties (owner or agent) ────────────────────────────────────────
  @Get('mine')
  @UseGuards(JwtAuthGuard)
  findMine(@Request() req) {
    const userId = req.user?.userId;
    const role = req.user?.role;
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

  // ── By Branch ─────────────────────────────────────────────────────────────
  @Get('branch/:branchId')
  findByBranch(@Param('branchId') branchId: string) {
    console.log('branchId received:', branchId);
    return this.propertiesService.findByBranch(branchId);
  }

  // ── Nearby POIs ──────────────────────────────────────────────────────────
  @Get('nearby')
  async getNearby(@Query() query: NearbyQueryDto): Promise<NearbyResponse> {
    return this.nearbyService.getNearby(query.lat, query.lng, query.radius);
  }

  // ── Get One ───────────────────────────────────────────────────────────────
  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  async findOne(@Param('id') id: string, @Request() req) {
    const property = await this.propertiesService.findOne(id);
    if (!req.user) {
      return {
        id: (property as any).id || (property as any)._id,
        title: (property as any).title,
        city: (property as any).city,
        price: (property as any).price,
      };
    }
    return property;
  }

  // ── Update ────────────────────────────────────────────────────────────────
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() dto: UpdatePropertyDto) {
    return this.propertiesService.update(id, dto);
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    console.log('🔴 DELETE ENDPOINT CALLED for property:', id);
    return this.propertiesService.remove(id);
  }
}
