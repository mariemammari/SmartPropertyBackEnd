import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { VisitsService } from './Visits.service';
import { CreateVisitDto, UpdateVisitDto } from './dto/visit.dto';

@Controller('visits')
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  @Post()
  create(@Body() dto: CreateVisitDto) {
    return this.visitsService.create(dto);
  }

  @Get()
  findAll() {
    return this.visitsService.findAll();
  }

  @Get('stats')
  getStats() {
    return this.visitsService.getStats();
  }

  @Get('urgent')
  findUrgent() {
    return this.visitsService.findUrgent();
  }

  @Get('today')
  findToday() {
    return this.visitsService.findToday();
  }

  @Get('property/:propertyId')
  findByProperty(@Param('propertyId') propertyId: string) {
    return this.visitsService.findByProperty(propertyId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.visitsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateVisitDto) {
    return this.visitsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.visitsService.remove(id);
  }
}
