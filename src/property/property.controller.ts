import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { PropertyService } from './property.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { FilesInterceptor } from '@nestjs/platform-express/multer';
import { memoryStorage } from 'multer';

@Controller('properties')
export class PropertyController {
    constructor(private readonly propertyService: PropertyService) { }




    @Post()
    create(@Body() createPropertyDto: CreatePropertyDto) {
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
