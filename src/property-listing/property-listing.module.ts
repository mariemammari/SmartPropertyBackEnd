import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  PropertyListing,
  PropertyListingSchema,
} from '../property-listing/schemas/property-listing.schema';
import { PropertyListingController } from '../property-listing/property-listing.controller';
import { PropertyListingService } from './property-listing.service';
import { RentalModule } from '../rental/rental.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PropertyListing.name, schema: PropertyListingSchema },
    ]),
    RentalModule,
  ],
  controllers: [PropertyListingController],
  providers: [PropertyListingService],
  exports: [PropertyListingService],
})
export class PropertyListingModule {}
