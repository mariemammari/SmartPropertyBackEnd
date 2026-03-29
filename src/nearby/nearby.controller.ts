import { Controller, Get, Query } from '@nestjs/common';
import { NearbyService, NearbyResponse } from './nearby.service';
import { NearbyQueryDto } from './nearby.dto';

@Controller('nearby')
export class NearbyController {
    constructor(private readonly nearbyService: NearbyService) { }

    @Get()
    async getNearby(@Query() query: NearbyQueryDto): Promise<NearbyResponse> {
        return this.nearbyService.getNearby(query.lat, query.lng, query.radius);
    }
}
