import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, UploadedFiles, UseInterceptors,
  HttpCode, HttpStatus, Query,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PropertyMediaService } from './property-media.service';
import { MediaTag } from '../Property-Media/schemas/property-media.schema';

@Controller('property-media')
export class PropertyMediaController {
  constructor(private readonly mediaService: PropertyMediaService) {}

  // POST /property-media/upload
  // Body: multipart/form-data
  // Fields: files[], propertyId, uploadedBy, listingId?, tag?
  @Post('upload')
  @UseInterceptors(
    FilesInterceptor('files', 20, {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max per file
      fileFilter: (_, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowed.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Only jpg, png, webp allowed'), false);
      },
    }),
  )
  uploadImages(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('propertyId') propertyId: string,
    @Body('uploadedBy') uploadedBy: string,
    @Body('listingId')  listingId?: string,
    @Body('tag')        tag?: MediaTag,
  ) {
    return this.mediaService.uploadImages(files, propertyId, uploadedBy, listingId, tag);
  }

  // GET /property-media/property/:propertyId
  @Get('property/:propertyId')
  findByProperty(@Param('propertyId') propertyId: string) {
    return this.mediaService.findByProperty(propertyId);
  }

  // GET /property-media/listing/:listingId
  @Get('listing/:listingId')
  findByListing(@Param('listingId') listingId: string) {
    return this.mediaService.findByListing(listingId);
  }

  // PATCH /property-media/:id/primary
  @Patch(':id/primary')
  setPrimary(
    @Param('id') id: string,
    @Body('propertyId') propertyId: string,
  ) {
    return this.mediaService.setPrimary(id, propertyId);
  }

  // PATCH /property-media/reorder
  @Patch('reorder')
  reorder(@Body() items: { id: string; order: number }[]) {
    return this.mediaService.reorder(items);
  }

  // DELETE /property-media/:id
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.mediaService.remove(id);
  }
}