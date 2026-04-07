import { Module, forwardRef } from '@nestjs/common';
import { PropertyService } from './property.service';
import { PropertyController } from './property.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Property, PropertySchema } from './schemas/property.schema';
import {
  PropertyListing,
  PropertyListingSchema,
} from '../property-listing/schemas/property-listing.schema';
import { User, UserSchema } from '../user/schemas/user.schema';
import { NotificationModule } from '../notification/notification.module';
import { RentalModule } from '../rental/rental.module';

@Module({
  providers: [PropertyService],
  controllers: [PropertyController],
  imports: [
    MongooseModule.forFeature([
      { name: Property.name, schema: PropertySchema },
      { name: PropertyListing.name, schema: PropertyListingSchema },
      { name: User.name, schema: UserSchema },
    ]),
    RentalModule,
    forwardRef(() => NotificationModule),
  ],
  exports: [PropertyService],
})
export class PropertyModule {}
