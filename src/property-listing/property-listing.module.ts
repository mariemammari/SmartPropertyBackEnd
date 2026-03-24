import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PropertyListing, PropertyListingSchema } from '../property-listing/schemas/property-listing.schema';
import { PropertyListingController } from '../property-listing/property-listing.controller';
import { PropertyListingService } from './property-listing.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PropertyListing.name, schema: PropertyListingSchema },
    ]),
  ],
  controllers: [PropertyListingController],
  providers:   [PropertyListingService],
  exports:     [PropertyListingService],
})
export class PropertyListingModule {}