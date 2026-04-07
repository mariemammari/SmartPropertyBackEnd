import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { RentalService } from './rental.service';
import { CreateRentalDto } from './dto/create-rental.dto';
import { UpdateRentalDto } from './dto/update-rental.dto';
import { CreateRentalPaymentIntentDto } from './dto/create-payment-intent.dto';
import { CreateOfflinePaymentDto } from './dto/create-offline-payment.dto';
import { VerifyOfflinePaymentDto } from './dto/verify-offline-payment.dto';
import { ValidateSucceededPaymentDto } from './dto/validate-succeeded-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guards';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../user/schemas/user.schema';

@Controller('rentals')
export class RentalController {
  constructor(private readonly rentalService: RentalService) { }

  /**
   * Creates a new rental record for a property and tenant.
   */
  @Post()
  create(@Body() dto: CreateRentalDto) {
    return this.rentalService.create(dto);
  }

  /**
   * Updates rental metadata and can trigger default contract creation when status becomes rented.
   */
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRentalDto) {
    return this.rentalService.update(id, dto);
  }

  /**
   * Returns rentals owned by one owner user.
   */
  @Get('owner/:ownerId')
  findByOwner(@Param('ownerId') ownerId: string) {
    return this.rentalService.findByOwner(ownerId);
  }

  /**
   * Returns active tenant rentals, deduplicated by property.
   */
  @Get('tenant/:tenantId')
  findByTenant(@Param('tenantId') tenantId: string) {
    return this.rentalService.findByTenant(tenantId);
  }

  /**
   * Returns all rentals linked to a property.
   */
  @Get('property/:propertyId')
  findByProperty(@Param('propertyId') propertyId: string) {
    return this.rentalService.findByProperty(propertyId);
  }

  /**
   * Returns all rentals for a specific branch (accessible to branch managers).
   */
  @Get('branch/:branchId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BRANCH_MANAGER)
  findByBranch(@Param('branchId') branchId: string) {
    return this.rentalService.findByBranch(branchId);
  }

  /**
   * Builds an expected payment schedule using rental frequency and listing amount.
   */
  @Get(':id/payment-schedule')
  getPaymentSchedule(@Param('id') rentalId: string) {
    return this.rentalService.getPaymentSchedule(rentalId);
  }

  /**
   * Creates a Stripe payment intent for one billing period (or provided custom period).
   */
  @Post(':id/payment-intent')
  createPaymentIntent(
    @Param('id') rentalId: string,
    @Body() dto: CreateRentalPaymentIntentDto,
  ) {
    return this.rentalService.createPaymentIntent(
      rentalId,
      dto.amount,
      dto.currency,
      dto.billingPeriodStart,
      dto.billingPeriodEnd,
    );
  }

  /**
   * Creates an offline payment request (cash or cheque) pending accountant verification.
   */
  @Post(':id/payments/offline')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ACCOUNTANT)
  createOfflinePayment(
    @Param('id') rentalId: string,
    @Body() dto: CreateOfflinePaymentDto,
    @Req() req: any,
  ) {
    return this.rentalService.createOfflinePayment(rentalId, dto, req.user);
  }

  /**
   * Verifies or rejects an offline payment and optionally generates an invoice on approval.
   */
  @Patch(':id/payments/:paymentId/verify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ACCOUNTANT)
  verifyOfflinePayment(
    @Param('id') rentalId: string,
    @Param('paymentId') paymentId: string,
    @Body() dto: VerifyOfflinePaymentDto,
    @Req() req: any,
  ) {
    return this.rentalService.verifyOfflinePayment(
      rentalId,
      paymentId,
      dto,
      req.user,
    );
  }

  /**
   * Validates a succeeded payment from accountant modal and ensures invoice linkage + broadcast.
   */
  @Patch(':id/payments/:paymentId/validate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ACCOUNTANT)
  validateSucceededPayment(
    @Param('id') rentalId: string,
    @Param('paymentId') paymentId: string,
    @Body() dto: ValidateSucceededPaymentDto,
    @Req() req: any,
  ) {
    return this.rentalService.validateSucceededPayment(
      rentalId,
      paymentId,
      dto,
      req.user,
    );
  }

  /**
   * Creates one Stripe intent for multi-month upfront payment.
   */
  @Post(':id/payment-intent/bulk')
  createMultiMonthPayment(
    @Param('id') rentalId: string,
    @Body() body: { monthsCount: number; startFromMonth?: Date },
  ) {
    return this.rentalService.createMultiMonthPayment(
      rentalId,
      body.monthsCount,
      body.startFromMonth,
    );
  }

  /**
   * Creates one Stripe intent for a partial tranche payment of a single month.
   */
  @Post(':id/payment-intent/tranche')
  createTranchedPayment(
    @Param('id') rentalId: string,
    @Body()
    body: { trancheAmount: number; trancheNumber: number; forMonth?: Date },
  ) {
    return this.rentalService.createTranchedPayment(
      rentalId,
      body.trancheAmount,
      body.trancheNumber,
      body.forMonth,
    );
  }

  /**
   * Stripe webhook endpoint that validates signature and dispatches payment events.
   */
  @Post('webhook/stripe')
  async handleStripeWebhook(@Req() req: Request) {
    const signature = req.headers['stripe-signature'] as string | undefined;
    const event = this.rentalService.constructStripeEvent(
      req.body as Buffer,
      signature,
    );
    await this.rentalService.handleStripeEvent(event);
    return { received: true };
  }

  /**
   * Accountant workspace: list active rentals scoped to authenticated accountant branch.
   */
  @Get('accountant/active-rentals')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ACCOUNTANT)
  getActiveRentalsForAccountant(@Req() req: any) {
    return this.rentalService.getActiveRentalsForAccountant(req.user);
  }

  /**
   * Accountant workspace: one active rental detail with payments and invoices.
   */
  @Get('accountant/active-rentals/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ACCOUNTANT)
  getAccountantRentalDetail(@Param('id') rentalId: string, @Req() req: any) {
    return this.rentalService.getAccountantRentalDetail(rentalId, req.user);
  }

  /**
   * Payment tracking timeline visible to rental participants and branch accountant.
   */
  @Get(':id/payments/tracking')
  @UseGuards(JwtAuthGuard)
  getRentalPaymentTracking(
    @Param('id') rentalId: string,
    @Req() req: any,
    @Query('monthsCount') monthsCount?: string,
    @Query('startFrom') startFrom?: string,
  ) {
    const monthsValue = monthsCount ? Number(monthsCount) : undefined;
    const parsedMonthsCount =
      monthsValue && !Number.isNaN(monthsValue) ? monthsValue : undefined;

    const startDateCandidate = startFrom ? new Date(startFrom) : undefined;
    const parsedStartFrom =
      startDateCandidate && !Number.isNaN(startDateCandidate.getTime())
        ? startDateCandidate
        : undefined;

    return this.rentalService.getRentalPaymentTracking(
      rentalId,
      req.user,
      parsedMonthsCount,
      parsedStartFrom,
    );
  }

  /**
   * Dashboard stats for active rentals, role-aware for accountant/agent/owner/tenant.
   */
  @Get('stats/active-rentals')
  @UseGuards(JwtAuthGuard)
  getActiveRentalStats(@Req() req: any) {
    return this.rentalService.getActiveRentalStats(req.user);
  }

  /**
   * Returns a single rental with populated relations.
   */
  @Get(':id')
  findById(@Param('id') id: string) {
    return this.rentalService.findById(id);
  }
}
