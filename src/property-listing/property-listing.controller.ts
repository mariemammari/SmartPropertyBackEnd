import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { PropertyListingService } from './property-listing.service';
import {
  CreatePropertyListingDto,
  UpdatePropertyListingDto,
  ListingFilterDto,
} from '../property-listing/dto/Property-listing.dto';

@Controller('property-listings')
export class PropertyListingController {
  constructor(private readonly listingService: PropertyListingService) {}

  @Post()
  create(@Body() dto: CreatePropertyListingDto) {
    return this.listingService.create(dto);
  }

  @Get()
  findAll(@Query() filters: ListingFilterDto) {
    return this.listingService.findAll(filters);
  }

  @Get('stats')
  getStats() {
    return this.listingService.getStats();
  }

  @Get('property/:propertyId')
  findByProperty(@Param('propertyId') propertyId: string) {
    return this.listingService.findByProperty(propertyId);
  }

  @Get('property/:propertyId/active')
  findActiveListing(@Param('propertyId') propertyId: string) {
    return this.listingService.findActiveListing(propertyId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.listingService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePropertyListingDto) {
    return this.listingService.update(id, dto);
  }

  @Patch(':id/submit-review')
  submitForReview(@Param('id') id: string) {
    return this.listingService.submitForReview(id);
  }

  @Patch(':id/archive')
  archive(@Param('id') id: string) {
    return this.listingService.archive(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.listingService.remove(id);
  }
}