import { Module } from '@nestjs/common';
import { NearbyService } from './nearby.service';
import { NearbyController } from './nearby.controller';

@Module({
  controllers: [NearbyController],
  providers: [NearbyService],
})
export class NearbyModule {}
