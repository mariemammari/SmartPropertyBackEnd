import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PropertySubmissionController } from './property-submission.controller';
import { PropertySubmissionService } from './services/property-submission.service';
import { AssignmentService } from './services/assignment.service';
import { Property, PropertySchema } from '../property/schemas/property.schema';
import {
  PropertyListing,
  PropertyListingSchema,
} from '../property-listing/schemas/property-listing.schema';
import { User, UserSchema } from '../user/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Property.name, schema: PropertySchema },
      { name: PropertyListing.name, schema: PropertyListingSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [PropertySubmissionController],
  providers: [PropertySubmissionService, AssignmentService],
  exports: [PropertySubmissionService, AssignmentService],
})
export class PropertySubmissionModule {}
