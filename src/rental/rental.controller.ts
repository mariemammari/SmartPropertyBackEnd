import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { RentalService } from './rental.service';
import { CreateRentalDto } from './dto/create-rental.dto';
import { UpdateRentalDto } from './dto/update-rental.dto';
import { CreateRentalPaymentIntentDto } from './dto/create-payment-intent.dto';

@Controller('rentals')
export class RentalController {
    constructor(private readonly rentalService: RentalService) { }

    @Post()
    create(@Body() dto: CreateRentalDto) {
        return this.rentalService.create(dto);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() dto: UpdateRentalDto) {
        return this.rentalService.update(id, dto);
    }

    @Get('owner/:ownerId')
    findByOwner(@Param('ownerId') ownerId: string) {
        return this.rentalService.findByOwner(ownerId);
    }

    @Get('tenant/:tenantId')
    findByTenant(@Param('tenantId') tenantId: string) {
        return this.rentalService.findByTenant(tenantId);
    }

    @Get('property/:propertyId')
    findByProperty(@Param('propertyId') propertyId: string) {
        return this.rentalService.findByProperty(propertyId);
    }

    @Get(':id/payment-schedule')
    getPaymentSchedule(@Param('id') rentalId: string) {
        return this.rentalService.getPaymentSchedule(rentalId);
    }

    @Post(':id/payment-intent')
    createPaymentIntent(@Param('id') rentalId: string, @Body() dto: CreateRentalPaymentIntentDto) {
        return this.rentalService.createPaymentIntent(rentalId, dto.amount, dto.currency);
    }

    @Post('webhook/stripe')
    async handleStripeWebhook(@Req() req: Request) {
        const signature = req.headers['stripe-signature'] as string | undefined;
        const event = this.rentalService.constructStripeEvent(req.body as Buffer, signature);
        await this.rentalService.handleStripeEvent(event);
        return { received: true };
    }

    @Get(':id')
    findById(@Param('id') id: string) {
        return this.rentalService.findById(id);
    }
}
