import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  PropertyMedia,
  PropertyMediaSchema,
} from '../Property-Media/schemas/property-media.schema';
import { PropertyMediaController } from './property-media.controller';
import { PropertyMediaService } from './property-media.service';
import { CloudinaryConfig } from '../Property-Media/cloudinary.config';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PropertyMedia.name, schema: PropertyMediaSchema },
    ]),
  ],
  controllers: [PropertyMediaController],
  providers: [PropertyMediaService, CloudinaryConfig],
  exports: [PropertyMediaService],
})
export class PropertyMediaModule {}
