import { Module, forwardRef } from '@nestjs/common';
import { PropertyService } from './property.service';
import { PropertyController } from './property.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Property, PropertySchema } from './schemas/property.schema';
import { NotificationModule } from '../notification/notification.module';

@Module({
  providers: [PropertyService],
  controllers: [PropertyController],
  imports: [
    MongooseModule.forFeature([{ name: Property.name, schema: PropertySchema }]),
    forwardRef(() => NotificationModule)
  ],
  exports: [PropertyService]
})
export class PropertyModule {}
