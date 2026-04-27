import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Application,
  ApplicationSchema,
} from '../application/schemas/application.schema';
import { Property, PropertySchema } from '../property/schemas/property.schema';
import { SolvencyController } from './solvency.controller';
import { SolvencyService } from './solvency.service';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Application.name, schema: ApplicationSchema },
      { name: Property.name, schema: PropertySchema },
    ]),
  ],
  controllers: [SolvencyController],
  providers: [SolvencyService],
  exports: [SolvencyService],
})
export class SolvencyModule {}
