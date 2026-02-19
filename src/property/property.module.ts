import { Module } from '@nestjs/common';
import { PropertyService } from './property.service';
import { PropertyController } from './property.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Property, PropertySchema } from './schemas/property.schema';
@Module({
  providers: [PropertyService],
  controllers: [PropertyController],
  //****************hana */
   imports: [
    MongooseModule.forFeature([{ name: Property.name, schema: PropertySchema }])
  ],

})
export class PropertyModule {}
