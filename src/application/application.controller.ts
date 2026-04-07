import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Patch,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { ApplicationService } from './application.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

@Controller('application')
export class ApplicationController {
  constructor(private readonly applicationService: ApplicationService) {}

  @Post()
  async createApplication(@Body() createDto: CreateApplicationDto) {
    return this.applicationService.create(createDto);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  async uploadDocument(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('File is missing');
    const url = await this.applicationService.uploadDocument(file);
    return { url };
  }

  @Get('agent/:agentId')
  async getAgentApplications(@Param('agentId') agentId: string) {
    return this.applicationService.findAllByAgent(agentId);
  }

  @Get('branch/:branchId')
  async getApplicationsByBranch(@Param('branchId') branchId: string) {
    return this.applicationService.findAllByBranch(branchId);
  }

  @Get('client/:clientId')
  async getClientApplications(@Param('clientId') clientId: string) {
    return this.applicationService.findAllByClient(clientId);
  }

  @Get('client/:clientId/property/:propertyId')
  async getClientLatestApplicationForProperty(
    @Param('clientId') clientId: string,
    @Param('propertyId') propertyId: string,
  ) {
    return this.applicationService.findLatestByClientAndProperty(
      clientId,
      propertyId,
    );
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.applicationService.findById(id);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() updateDto: UpdateApplicationDto,
  ) {
    return this.applicationService.updateStatus(id, updateDto);
  }

  @Get('property/:propertyId/')
  async getApplicationsForProperty(@Param('propertyId') propertyId: string) {
    return this.applicationService.findAllByProperty(propertyId);
  }
}
