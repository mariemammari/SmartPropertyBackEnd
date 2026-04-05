import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PropertyEngagementController } from './property-engagement.controller';
import { PropertyEngagementService } from './property-engagement.service';
import {
  PropertyEngagementEvent,
  PropertyEngagementEventSchema,
} from './schemas/property-engagement-event.schema';
import { Property, PropertySchema } from '../property/schemas/property.schema';
import { User, UserSchema } from '../user/schemas/user.schema';
import { RolesGuard } from '../auth/guards/roles.guards';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    NotificationsModule,
    MongooseModule.forFeature([
      { name: PropertyEngagementEvent.name, schema: PropertyEngagementEventSchema },
      { name: Property.name, schema: PropertySchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [PropertyEngagementController],
  providers: [PropertyEngagementService, RolesGuard],
  exports: [PropertyEngagementService],
})
export class PropertyEngagementModule {}
