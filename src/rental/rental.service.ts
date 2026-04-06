import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';
import { Rental, RentalDocument } from './schemas/rental.schema';
import { RentalPayment, RentalPaymentDocument, RentalPaymentMethod, RentalPaymentStatus } from './schemas/rental-payment.schema';
import { RentalContract, RentalContractDocument } from './schemas/rental-contract.schema';
import { CreateRentalDto } from './dto/create-rental.dto';
import { UpdateRentalDto } from './dto/update-rental.dto';
import { CreateOfflinePaymentDto } from './dto/create-offline-payment.dto';
import { VerifyOfflinePaymentDto } from './dto/verify-offline-payment.dto';
import { ValidateSucceededPaymentDto } from './dto/validate-succeeded-payment.dto';
import { Property, PropertyDocument, PropertyStatus, TransactionType } from '../property/schemas/property.schema';
import { PropertyListing, PropertyListingDocument, ListingStatus } from '../property-listing/schemas/property-listing.schema';
import { Application, ApplicationDocument, ApplicationStatus } from '../application/schemas/application.schema';
import { User, UserDocument, UserRole } from '../user/schemas/user.schema';
import { MailService } from '../mail/mail.service';
import { RentalContractService } from './rental-contract.service';
import { FinanceService } from '../finance/finance.service';

interface CreateRentalFromStatusChangeInput {
    propertyId: string;
    propertyListingId?: string;
    tenantId?: string;
    durationMonths?: number;
    paymentFrequencyMonths?: number;
    autoRenew?: boolean;
    noticePeriodDays?: number;
    contractSignedAt?: Date;
    moveInDate?: Date;
    moveOutDate?: Date;
    notes?: string;
}

interface AuthenticatedUserContext {
    userId?: string;
    role?: string;
    branchId?: string;
}

interface PaymentBreakdown {
    rentAmount: number;
    agencyFeeAmount: number;
    depositAmount: number;
    totalDue: number;
    isInitialPaymentPeriod: boolean;
    coveredMonths: number;
}

interface PaymentAllocation {
    rentAmount: number;
    agencyFeeAmount: number;
    depositAmount: number;
    allocatedTotal: number;
}

const ACTIVE_RENTAL_STATUSES = ['pending', 'rented'];

@Injectable()
export class RentalService {
    private stripe: Stripe | null;
    private stripeWebhookSecret: string | null;
    private readonly forceStripeSucceededOnCreate: boolean;

    constructor(
        private readonly configService: ConfigService,
        private readonly mailService: MailService,
        private readonly contractService: RentalContractService,
        private readonly financeService: FinanceService,
        @InjectModel(Rental.name) private rentalModel: Model<RentalDocument>,
        @InjectModel(RentalPayment.name) private rentalPaymentModel: Model<RentalPaymentDocument>,
        @InjectModel(RentalContract.name) private contractModel: Model<RentalContractDocument>,
        @InjectModel(Property.name) private propertyModel: Model<PropertyDocument>,
        @InjectModel(PropertyListing.name) private listingModel: Model<PropertyListingDocument>,
        @InjectModel(Application.name) private applicationModel: Model<ApplicationDocument>,
        @InjectModel(User.name) private userModel: Model<UserDocument>,
    ) {
        const stripeKey = (this.configService.get<string>('STRIPE_SECRET_KEY') ?? '').trim();
        const webhookSecret = (this.configService.get<string>('STRIPE_WEBHOOK_SECRET') ?? '').trim();
        this.stripeWebhookSecret = webhookSecret || null;
        this.stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: '2023-10-16' as any }) : null;
        this.forceStripeSucceededOnCreate =
            (this.configService.get<string>('FORCE_STRIPE_SUCCEEDED_ON_CREATE') ?? 'true').trim().toLowerCase() !== 'false';
    }

    /**
     * Creates a rental while preventing duplicate active rental records for the same property/tenant pair.
     */
    async create(dto: CreateRentalDto): Promise<Rental> {
        const existingActive = await this.rentalModel.findOne({
            propertyId: new Types.ObjectId(dto.propertyId),
            tenantId: new Types.ObjectId(dto.tenantId),
            status: { $in: ACTIVE_RENTAL_STATUSES },
        }).sort({ createdAt: -1 }).exec();

        if (existingActive) {
            return existingActive;
        }

        const frequency = dto.paymentFrequencyMonths ?? 1;
        const baseDate = dto.moveInDate ?? dto.contractSignedAt;
        const nextPaymentDue = dto.nextPaymentDue ?? (baseDate && frequency > 0
            ? this.addMonths(baseDate, frequency)
            : undefined);

        const rental = new this.rentalModel({
            ...dto,
            propertyId: new Types.ObjectId(dto.propertyId),
            propertyListingId: new Types.ObjectId(dto.propertyListingId),
            ownerId: new Types.ObjectId(dto.ownerId),
            tenantId: new Types.ObjectId(dto.tenantId),
            agentId: dto.agentId ? new Types.ObjectId(dto.agentId) : undefined,
            outstandingBalance: dto.outstandingBalance ?? 0,
            autoRenew: dto.autoRenew ?? false,
            paymentFrequencyMonths: frequency,
            nextPaymentDue,
        });

        return rental.save();
    }

    /**
     * Updates rental fields and auto-creates a default contract when status changes to rented.
     */
    async update(id: string, dto: UpdateRentalDto): Promise<Rental> {
        const update: Record<string, any> = { ...dto };
        if (dto.tenantId) update.tenantId = new Types.ObjectId(dto.tenantId);
        if (dto.agentId) update.agentId = new Types.ObjectId(dto.agentId);

        const oldRental = await this.rentalModel.findById(id).exec();
        if (!oldRental) throw new NotFoundException('Rental not found');

        const rental = await this.rentalModel.findByIdAndUpdate(id, update, { new: true }).exec();
        if (!rental) throw new NotFoundException('Rental not found');

        // ✅ AUTO-CREATE CONTRACT when status changes to 'rented'
        if (dto.status === 'rented' && oldRental.status !== 'rented') {
            await this.createDefaultContractForRental(rental);
        }

        return rental;
    }

    /**
     * Returns one rental with populated property and participants.
     */
    async findById(id: string): Promise<Rental> {
        const rental = await this.rentalModel
            .findById(id)
            .populate('propertyId')
            .populate('propertyListingId')
            .populate('ownerId', 'fullName email phone')
            .populate('tenantId', 'fullName email phone')
            .populate('agentId', 'fullName email phone')
            .exec();
        if (!rental) throw new NotFoundException('Rental not found');
        return rental;
    }

    /**
     * Lists rentals by owner in reverse chronological order.
     */
    async findByOwner(ownerId: string): Promise<Rental[]> {
        return this.rentalModel
            .find({ ownerId: new Types.ObjectId(ownerId) })
            .sort({ createdAt: -1 })
            .exec();
    }

    /**
     * Lists tenant active rentals and deduplicates by property for tenant-facing views.
     */
    async findByTenant(tenantId: string): Promise<Rental[]> {
        const rentals = await this.rentalModel
            .find({ tenantId: new Types.ObjectId(tenantId) })
            .sort({ createdAt: -1 })
            .exec();

        // Return only one latest ACTIVE rental per property for tenant-facing views.
        const seenProperty = new Set<string>();
        const result: Rental[] = [];

        for (const rental of rentals) {
            const normalizedStatus = String((rental as any).status ?? '').trim().toLowerCase();
            const isActive = ACTIVE_RENTAL_STATUSES.includes(normalizedStatus);
            if (!isActive) {
                continue;
            }

            const propertyKey = String((rental as any).propertyId?._id ?? (rental as any).propertyId);
            if (!propertyKey || seenProperty.has(propertyKey)) {
                continue;
            }

            seenProperty.add(propertyKey);
            result.push(rental);
        }

        return result;
    }

    /**
     * Lists all rentals that belong to a property.
     */
    async findByProperty(propertyId: string): Promise<Rental[]> {
        return this.rentalModel
            .find({ propertyId: new Types.ObjectId(propertyId) })
            .sort({ createdAt: -1 })
            .exec();
    }

    /**
     * Returns active rentals visible to the authenticated accountant based on branch ownership.
     */
    async getActiveRentalsForAccountant(requester: AuthenticatedUserContext): Promise<any[]> {
        const accountant = await this.resolveAccountantContext(requester);

        const rentals = await this.rentalModel
            .find({
                status: { $in: ACTIVE_RENTAL_STATUSES },
                branchId: accountant.branchId,
            })
            .sort({ createdAt: -1 })
            .populate('propertyId', 'title address city branchId')
            .populate('propertyListingId', 'price fees')
            .populate('ownerId', 'fullName email phone')
            .populate('tenantId', 'fullName email phone')
            .populate('agentId', 'fullName email phone')
            .exec();

        const nowMonthStart = this.getMonthStart(new Date());
        const nowMonthEnd = this.addMonths(nowMonthStart, 1);

        return Promise.all(rentals.map(async (rental) => {
            const status = await this.getPaymentStatusForPeriod(
                rental._id.toString(),
                nowMonthStart,
                nowMonthEnd,
            );

            return {
                rental,
                currentMonth: {
                    periodStart: nowMonthStart,
                    periodEnd: nowMonthEnd,
                    ...status,
                },
            };
        }));
    }

    /**
     * Returns full rental detail + payments + monthly tracking for accountant workspace.
     */
    async getAccountantRentalDetail(rentalId: string, requester: AuthenticatedUserContext): Promise<any> {
        const rental = await this.rentalModel
            .findById(rentalId)
            .populate('propertyId')
            .populate('propertyListingId')
            .populate('ownerId', 'fullName email phone')
            .populate('tenantId', 'fullName email phone')
            .populate('agentId', 'fullName email phone')
            .exec();

        if (!rental) throw new NotFoundException('Rental not found');

        await this.assertAccountantCanAccessRental(rental, requester);

        const payments = await this.rentalPaymentModel
            .find({ rentalId: rental._id })
            .sort({ createdAt: -1 })
            .populate('invoiceId', 'invoiceNumber total paid status date signatureUrl pdfUrl pdfPublicId paymentBreakdown billingPeriodStart billingPeriodEnd')
            .exec();

        const tracking = await this.getRentalPaymentTracking(rentalId, requester, 18);

        return {
            rental,
            payments,
            tracking,
        };
    }

    /**
     * Returns month-level payment tracking and invoice visibility for rental participants and branch accountant.
     */
    async getRentalPaymentTracking(
        rentalId: string,
        requester: AuthenticatedUserContext,
        monthsCount = 12,
        startFrom?: Date,
    ): Promise<any> {
        const rental = await this.rentalModel.findById(rentalId).exec();
        if (!rental) throw new NotFoundException('Rental not found');

        const listing = await this.listingModel.findById(rental.propertyListingId).exec();
        if (!listing) throw new NotFoundException('Property listing not found');

        await this.assertRentalTrackingAccess(rental, requester);

        const requestedMonths = Number(monthsCount ?? 12);
        const safeMonthsCount = Number.isFinite(requestedMonths)
            ? Math.min(Math.max(requestedMonths, 1), 24)
            : 12;
        const startMonth = this.getMonthStart(startFrom ?? this.getInitialBillingPeriodStart(rental));
        const endMonth = this.addMonths(startMonth, safeMonthsCount);

        const payments = await this.rentalPaymentModel
            .find({
                rentalId: rental._id,
                billingPeriodStart: { $lt: endMonth },
                billingPeriodEnd: { $gt: startMonth },
            })
            .populate('invoiceId', 'invoiceNumber total paid status date signatureUrl pdfUrl pdfPublicId paymentBreakdown billingPeriodStart billingPeriodEnd')
            .sort({ billingPeriodStart: 1, createdAt: 1 })
            .exec();

        const timeline: any[] = [];

        for (let i = 0; i < safeMonthsCount; i++) {
            const periodStart = this.addMonths(startMonth, i);
            const periodEnd = this.addMonths(periodStart, 1);
            const status = await this.getPaymentStatusForPeriod(rentalId, periodStart, periodEnd);

            const monthPayments = payments.filter((payment) => this.isPaymentOverlappingMonth(payment, periodStart, periodEnd));
            const invoices = monthPayments
                .filter((payment) => !!payment.invoiceId)
                .map((payment) => ({
                    paymentId: payment._id,
                    paymentStatus: payment.status,
                    invoice: payment.invoiceId,
                }));

            timeline.push({
                periodStart,
                periodEnd,
                ...status,
                invoices,
            });
        }

        return {
            rentalId: rental._id,
            monthsCount: safeMonthsCount,
            startFrom: startMonth,
            timeline,
        };
    }

    /**
     * Role-aware stats for active rental dashboard pages.
     */
    async getActiveRentalStats(requester: AuthenticatedUserContext): Promise<any> {
        const role = String(requester?.role ?? '').toLowerCase();
        const userId = String(requester?.userId ?? '');

        if (!userId) {
            throw new ForbiddenException('Authentication required');
        }

        const baseActiveFilter: any = { status: { $in: ACTIVE_RENTAL_STATUSES } };

        if (role === UserRole.ACCOUNTANT) {
            const accountant = await this.resolveAccountantContext(requester);
            baseActiveFilter.branchId = accountant.branchId;
        } else if (role === UserRole.BRANCH_MANAGER) {
            const manager = await this.userModel.findById(userId).exec();
            if (manager?.branchId) {
                baseActiveFilter.branchId = manager.branchId;
            }
        } else if (role === UserRole.REAL_ESTATE_AGENT) {
            baseActiveFilter.agentId = new Types.ObjectId(userId);
        } else if (role === UserRole.CLIENT) {
            baseActiveFilter.$or = [
                { ownerId: new Types.ObjectId(userId) },
                { tenantId: new Types.ObjectId(userId) },
            ];
        } else if (role === UserRole.SUPER_ADMIN) {
            // Keep super admin unrestricted for operational monitoring.
        } else {
            baseActiveFilter.tenantId = new Types.ObjectId(userId);
        }

        const rentals = await this.rentalModel.find(baseActiveFilter).exec();
        const rentalIds = rentals.map((r) => r._id);

        const now = new Date();
        const monthStart = this.getMonthStart(now);
        const monthEnd = this.addMonths(monthStart, 1);

        const monthPayments = rentalIds.length > 0
            ? await this.rentalPaymentModel.find({
                rentalId: { $in: rentalIds },
                billingPeriodStart: { $lt: monthEnd },
                billingPeriodEnd: { $gt: monthStart },
            }).exec()
            : [];

        const succeededStatuses = new Set([RentalPaymentStatus.SUCCEEDED, RentalPaymentStatus.VERIFIED]);
        const paidThisMonth = monthPayments
            .filter((p) => succeededStatuses.has(p.status))
            .reduce((sum, p) => sum + Number(p.amount ?? 0), 0);

        const pendingThisMonth = monthPayments
            .filter((p) => p.status === RentalPaymentStatus.PENDING)
            .reduce((sum, p) => sum + Number(p.amount ?? 0), 0);

        const overdueCount = rentals.filter((r) => {
            const due = r.nextPaymentDue ? new Date(r.nextPaymentDue) : null;
            return !!due && due < now;
        }).length;

        const byStatus = rentals.reduce((acc: Record<string, number>, rental) => {
            const key = String((rental as any).status ?? 'unknown');
            acc[key] = (acc[key] ?? 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const outstandingTotal = rentals.reduce((sum, rental) => sum + Number(rental.outstandingBalance ?? 0), 0);

        const base = {
            role,
            activeRentals: rentals.length,
            overdueRentals: overdueCount,
            paidThisMonth: this.round2(paidThisMonth),
            pendingThisMonth: this.round2(pendingThisMonth),
            outstandingBalanceTotal: this.round2(outstandingTotal),
            statusBreakdown: byStatus,
        };

        if (
            role === UserRole.ACCOUNTANT
            || role === UserRole.REAL_ESTATE_AGENT
            || role === UserRole.SUPER_ADMIN
            || role === UserRole.BRANCH_MANAGER
        ) {
            return {
                ...base,
                statsType: 'business',
                businessKpis: {
                    collectionRatePercent: paidThisMonth + pendingThisMonth > 0
                        ? this.round2((paidThisMonth / (paidThisMonth + pendingThisMonth)) * 100)
                        : 0,
                    avgOutstandingPerRental: rentals.length > 0
                        ? this.round2(outstandingTotal / rentals.length)
                        : 0,
                },
            };
        }

        return {
            ...base,
            statsType: 'personal',
            personalKpis: {
                nextPaymentDueCount: rentals.filter((r) => !!r.nextPaymentDue).length,
                paidRentalsCount: rentals.filter((r) => Number(r.outstandingBalance ?? 0) <= 0).length,
            },
        };
    }

    /**
     * Computes expected installment schedule from rental frequency and listing rent amount.
     */
    async getPaymentSchedule(rentalId: string): Promise<{
        rentalId: string;
        amount: number;
        currency: string;
        paymentFrequencyMonths: number;
        durationMonths?: number;
        estimated: boolean;
        schedule: { dueDate: Date; amount: number }[];
    }> {
        const rental = await this.rentalModel.findById(rentalId).exec();
        if (!rental) throw new NotFoundException('Rental not found');

        const listing = await this.listingModel.findById(rental.propertyListingId).exec();
        if (!listing) throw new NotFoundException('Property listing not found');

        const rentAmount = this.getListingRentAmount(listing);
        const agencyFee = this.getListingAgencyFee(listing);
        const monthlyBaseAmount = rentAmount + agencyFee;
        const depositAmount = this.getListingDepositAmount(listing, rentAmount);
        const currency = 'eur';
        const frequency = rental.paymentFrequencyMonths ?? 1;
        const duration = rental.durationMonths;
        const startDate = rental.nextPaymentDue
            ?? rental.moveInDate
            ?? rental.contractSignedAt
            ?? (rental as any).createdAt
            ?? new Date();

        const scheduleCount = duration && duration > 0
            ? Math.max(1, Math.ceil(duration / frequency))
            : 12;

        const initialBillingPeriodStart = this.getInitialBillingPeriodStart(rental);

        const schedule = Array.from({ length: scheduleCount }).map((_, index) => {
            const dueDate = this.addMonths(startDate, index * frequency);
            const isInitialPeriod = index === 0 && this.isSameBillingMonth(dueDate, initialBillingPeriodStart);

            return {
                dueDate,
                amount: isInitialPeriod ? monthlyBaseAmount + depositAmount : monthlyBaseAmount,
            };
        });

        return {
            rentalId: rental._id.toString(),
            amount: monthlyBaseAmount,
            currency,
            paymentFrequencyMonths: frequency,
            durationMonths: duration ?? undefined,
            estimated: !(duration && duration > 0),
            schedule,
        };
    }

    /**
     * Creates a rental automatically when a property status transition implies active renting.
     */
    async createFromPropertyStatusChange(input: CreateRentalFromStatusChangeInput): Promise<Rental> {
        console.log('🔷 [createFromPropertyStatusChange] Starting rental creation with input:', input);

        const property = await this.propertyModel.findById(input.propertyId).exec();
        console.log('🔷 [createFromPropertyStatusChange] Property found:', property?._id, 'Type:', property?.type, 'TransactionType.RENT:', TransactionType.RENT);
        if (!property) throw new NotFoundException('Property not found');

        if (property.type !== TransactionType.RENT) {
            console.log('❌ [createFromPropertyStatusChange] Property type is not RENT. Type:', property.type);
            throw new BadRequestException('Rental can only be created for rent transactions');
        }

        const existing = await this.rentalModel.findOne({
            propertyId: new Types.ObjectId(input.propertyId),
            status: { $in: ACTIVE_RENTAL_STATUSES },
        }).sort({ createdAt: -1 }).exec();
        if (existing) {
            console.log('🟡 [createFromPropertyStatusChange] Rental already exists:', existing._id);
            return existing;
        }

        const listing = input.propertyListingId
            ? await this.listingModel.findById(input.propertyListingId).exec()
            : await this.listingModel.findOne({ propertyId: new Types.ObjectId(input.propertyId) }).sort({ createdAt: -1 }).exec();

        console.log('🔷 [createFromPropertyStatusChange] Listing found:', listing?._id);
        if (!listing) throw new BadRequestException('Property listing not found for rental creation');

        const tenantId = await this.resolveTenantId(input.propertyId, input.tenantId);
        console.log('🔷 [createFromPropertyStatusChange] Tenant ID resolved:', tenantId);

        return this.create({
            propertyId: input.propertyId,
            propertyListingId: listing._id.toString(),
            ownerId: property.ownerId.toString(),
            tenantId,
            agentId: property.createdBy ? property.createdBy.toString() : undefined,
            branchId: property.branchId ?? undefined,
            durationMonths: input.durationMonths,
            paymentFrequencyMonths: input.paymentFrequencyMonths,
            autoRenew: input.autoRenew,
            noticePeriodDays: input.noticePeriodDays,
            contractSignedAt: input.contractSignedAt,
            moveInDate: input.moveInDate,
            moveOutDate: input.moveOutDate,
            notes: input.notes,
        });
    }

    /**
     * Creates a rental automatically when a listing status transition implies active renting.
     */
    async createFromListingStatusChange(listingId: string, input: CreateRentalFromStatusChangeInput): Promise<Rental> {
        const listing = await this.listingModel.findById(listingId).exec();
        if (!listing) throw new NotFoundException('Property listing not found');

        const property = await this.propertyModel.findById(listing.propertyId).exec();
        if (!property) throw new NotFoundException('Property not found');

        if (property.type !== TransactionType.RENT) {
            throw new BadRequestException('Rental can only be created for rent transactions');
        }

        const existing = await this.rentalModel.findOne({
            propertyId: new Types.ObjectId(property._id),
            status: { $in: ACTIVE_RENTAL_STATUSES },
        }).sort({ createdAt: -1 }).exec();
        if (existing) return existing;

        const tenantId = await this.resolveTenantId(property._id.toString(), input.tenantId);

        return this.create({
            propertyId: property._id.toString(),
            propertyListingId: listing._id.toString(),
            ownerId: property.ownerId.toString(),
            tenantId,
            agentId: listing.agentId ? listing.agentId.toString() : undefined,
            branchId: listing.branchId ? listing.branchId.toString() : property.branchId ?? undefined,
            durationMonths: input.durationMonths,
            paymentFrequencyMonths: input.paymentFrequencyMonths,
            autoRenew: input.autoRenew,
            noticePeriodDays: input.noticePeriodDays,
            contractSignedAt: input.contractSignedAt,
            moveInDate: input.moveInDate,
            moveOutDate: input.moveOutDate,
            notes: input.notes,
        });
    }

    /**
     * Marks all active rentals for a property as terminated (used when a rented property becomes available).
     */
    async terminateActiveRentalsForProperty(propertyId: string): Promise<number> {
        const now = new Date();
        const result = await this.rentalModel.updateMany(
            {
                propertyId: new Types.ObjectId(propertyId),
                status: { $in: ACTIVE_RENTAL_STATUSES },
            },
            {
                $set: {
                    status: 'terminated',
                    moveOutDate: now,
                    updatedAt: now,
                },
            },
        ).exec();

        return result.modifiedCount ?? 0;
    }

    /**
     * Creates a Stripe payment intent and a pending payment row for one billing period.
     */
    async createPaymentIntent(
        rentalId: string,
        amount?: number,
        currency?: string,
        billingPeriodStart?: Date,
        billingPeriodEnd?: Date,
    ): Promise<{ clientSecret: string; paymentId: string }> {
        if (!this.stripe) throw new BadRequestException('Stripe is not configured');

        const rental = await this.rentalModel.findById(rentalId).exec();
        if (!rental) throw new NotFoundException('Rental not found');

        const listing = await this.listingModel.findById(rental.propertyListingId).exec();
        if (!listing) throw new NotFoundException('Property listing not found');

        const normalizedCurrency = (currency ?? 'eur').toLowerCase();

        // Calculate billing period if not provided (default: next month)
        const baseDate = billingPeriodStart ?? rental.nextPaymentDue ?? rental.moveInDate ?? new Date();
        const periodStart = billingPeriodStart ?? this.getMonthStart(baseDate);
        const periodEnd = billingPeriodEnd ?? this.addMonths(periodStart, 1);

        const dueBreakdown = await this.getOutstandingBreakdownForSinglePeriod(
            rental,
            listing,
            periodStart,
            periodEnd,
        );
        const minimumRequiredAmount = dueBreakdown.totalDue;

        const paymentAmount = amount ?? minimumRequiredAmount;
        if (paymentAmount <= 0) throw new BadRequestException('Payment amount must be greater than zero');
        if (minimumRequiredAmount <= 0) {
            throw new BadRequestException('This billing period is already fully paid');
        }
        if (paymentAmount < minimumRequiredAmount) {
            throw new BadRequestException(
                `Payment amount must include required dues (minimum ${minimumRequiredAmount} EUR)`,
            );
        }

        const allocation = this.allocatePaymentAmount(paymentAmount, dueBreakdown);

        const amountInSmallestUnit = Math.round(paymentAmount * 100);

        const intent = await this.stripe.paymentIntents.create({
            amount: amountInSmallestUnit,
            currency: normalizedCurrency,
            metadata: {
                rentalId: rental._id.toString(),
                propertyId: rental.propertyId.toString(),
                rentAmount: allocation.rentAmount.toFixed(2),
                agencyFeeAmount: allocation.agencyFeeAmount.toFixed(2),
                depositAmount: allocation.depositAmount.toFixed(2),
            },
            automatic_payment_methods: { enabled: true },
        });

        const payment = await this.rentalPaymentModel.create({
            rentalId: rental._id,
            amount: paymentAmount,
            rentAmount: allocation.rentAmount,
            agencyFeeAmount: allocation.agencyFeeAmount,
            depositAmount: allocation.depositAmount,
            totalDueForPeriod: dueBreakdown.totalDue,
            isInitialPaymentPeriod: dueBreakdown.isInitialPaymentPeriod,
            coveredMonths: 1,
            currency: normalizedCurrency,
            paymentMethod: RentalPaymentMethod.STRIPE,
            stripePaymentIntentId: intent.id,
            status: RentalPaymentStatus.PENDING,
            billingPeriodStart: periodStart,
            billingPeriodEnd: periodEnd,
            isMultiMonth: false,
            trancheNumber: 1,
        });

        if (!intent.client_secret) {
            throw new BadRequestException('Stripe client secret missing');
        }

        await this.maybeForceStripeSuccessOnCreate(rental, payment);

        return { clientSecret: intent.client_secret, paymentId: payment._id.toString() };
    }

    /**
     * Creates an offline payment record (cash/cheque) pending manual verification.
     */
    async createOfflinePayment(
        rentalId: string,
        dto: CreateOfflinePaymentDto,
        requester: AuthenticatedUserContext,
    ): Promise<RentalPayment> {
        const accountant = await this.resolveAccountantContext(requester);

        const rental = await this.rentalModel.findById(rentalId).exec();
        if (!rental) throw new NotFoundException('Rental not found');

        await this.assertAccountantCanAccessRental(rental, requester);

        const listing = await this.listingModel.findById(rental.propertyListingId).exec();
        if (!listing) throw new NotFoundException('Property listing not found');

        const baseDate = dto.billingPeriodStart ?? rental.nextPaymentDue ?? rental.moveInDate ?? new Date();
        const periodStart = dto.billingPeriodStart ?? this.getMonthStart(baseDate);
        const periodEnd = dto.billingPeriodEnd ?? this.addMonths(periodStart, 1);

        const dueBreakdown = await this.getOutstandingBreakdownForSinglePeriod(
            rental,
            listing,
            periodStart,
            periodEnd,
        );
        const minimumRequiredAmount = dueBreakdown.totalDue;

        if (minimumRequiredAmount <= 0) {
            throw new BadRequestException('This billing period is already fully paid');
        }
        if (dto.amount < minimumRequiredAmount) {
            throw new BadRequestException(
                `Offline payment amount must include required dues (minimum ${minimumRequiredAmount} EUR)`,
            );
        }

        if (dto.paymentMethod === RentalPaymentMethod.CHEQUE && !dto.chequeNumber) {
            throw new BadRequestException('chequeNumber is required for cheque payments');
        }

        if (dto.paymentMethod === RentalPaymentMethod.CHEQUE && (!dto.chequeDate || !dto.bankName)) {
            throw new BadRequestException('chequeDate and bankName are required for cheque payments');
        }

        const allocation = this.allocatePaymentAmount(dto.amount, dueBreakdown);
        const isCash = dto.paymentMethod === RentalPaymentMethod.CASH;

        const payment = await this.rentalPaymentModel.create({
            rentalId: rental._id,
            amount: dto.amount,
            rentAmount: allocation.rentAmount,
            agencyFeeAmount: allocation.agencyFeeAmount,
            depositAmount: allocation.depositAmount,
            totalDueForPeriod: dueBreakdown.totalDue,
            isInitialPaymentPeriod: dueBreakdown.isInitialPaymentPeriod,
            coveredMonths: 1,
            currency: (dto.currency ?? 'eur').toLowerCase(),
            paymentMethod: dto.paymentMethod,
            paymentMethodNote: dto.paymentMethodNote,
            paymentProofUrl: dto.paymentProofUrl,
            chequeNumber: dto.chequeNumber,
            chequeDate: dto.chequeDate,
            bankName: dto.bankName,
            status: RentalPaymentStatus.PENDING,
            billingPeriodStart: periodStart,
            billingPeriodEnd: periodEnd,
            isMultiMonth: false,
            trancheNumber: 1,
        });

        if (isCash) {
            payment.status = RentalPaymentStatus.SUCCEEDED;
            payment.verifiedBy = new Types.ObjectId(String(accountant._id));
            payment.verifiedAt = new Date();
            payment.paidAt = new Date();

            const invoiceId = await this.ensureInvoiceForSucceededPayment(
                rental,
                payment,
                String(accountant._id),
                dto.rentalContractId,
            );
            payment.invoiceId = new Types.ObjectId(invoiceId);
            await payment.save();

            await this.refreshRentalPaymentProgress(rental, payment);

            await this.notifyPaymentSuccess(rental, payment);
        }

        return payment;
    }

    /**
     * Approves/rejects offline payments and applies rental/accounting side-effects on approval.
     */
    async verifyOfflinePayment(
        rentalId: string,
        paymentId: string,
        dto: VerifyOfflinePaymentDto,
        requester: AuthenticatedUserContext,
    ): Promise<RentalPayment> {
        const accountant = await this.resolveAccountantContext(requester);

        const payment = await this.rentalPaymentModel.findById(paymentId).exec();
        if (!payment) throw new NotFoundException('Payment not found');
        if (payment.rentalId.toString() !== rentalId) {
            throw new BadRequestException('Payment does not belong to this rental');
        }
        if (payment.paymentMethod === RentalPaymentMethod.STRIPE) {
            throw new BadRequestException('Stripe payments are verified by webhook');
        }

        if (!dto.approved) {
            payment.status = RentalPaymentStatus.FAILED;
            payment.paymentMethodNote = dto.paymentMethodNote ?? payment.paymentMethodNote;
            await payment.save();
            return payment;
        }

        const rental = await this.rentalModel.findById(payment.rentalId).exec();
        if (!rental) throw new NotFoundException('Rental not found');

        await this.assertAccountantCanAccessRental(rental, requester);

        payment.status = RentalPaymentStatus.SUCCEEDED;
        payment.verifiedBy = new Types.ObjectId(String(accountant._id));
        payment.verifiedAt = new Date();
        payment.paidAt = new Date();
        payment.paymentMethodNote = dto.paymentMethodNote ?? payment.paymentMethodNote;

        const invoiceId = await this.ensureInvoiceForSucceededPayment(
            rental,
            payment,
            String(accountant._id),
            dto.rentalContractId,
        );
        payment.invoiceId = new Types.ObjectId(invoiceId);

        await payment.save();
        await this.refreshRentalPaymentProgress(rental, payment);

        await this.notifyPaymentSuccess(rental, payment);
        return payment;
    }

    /**
     * Validates a succeeded payment from accountant workspace modal.
     * Ensures invoice exists and optionally re-broadcasts invoice notification emails.
     */
    async validateSucceededPayment(
        rentalId: string,
        paymentId: string,
        dto: ValidateSucceededPaymentDto,
        requester: AuthenticatedUserContext,
    ): Promise<RentalPayment> {
        if (!dto.approved) {
            throw new BadRequestException('Payment validation was not approved');
        }

        const accountant = await this.resolveAccountantContext(requester);

        const payment = await this.rentalPaymentModel.findById(paymentId).exec();
        if (!payment) throw new NotFoundException('Payment not found');
        if (payment.rentalId.toString() !== rentalId) {
            throw new BadRequestException('Payment does not belong to this rental');
        }

        const rental = await this.rentalModel.findById(payment.rentalId).exec();
        if (!rental) throw new NotFoundException('Rental not found');

        await this.assertAccountantCanAccessRental(rental, requester);

        if (![RentalPaymentStatus.SUCCEEDED, RentalPaymentStatus.VERIFIED].includes(payment.status)) {
            throw new BadRequestException('Only succeeded payments can be validated from this action');
        }

        if (!payment.invoiceId) {
            const invoiceId = await this.ensureInvoiceForSucceededPayment(
                rental,
                payment,
                String(accountant._id),
                dto.rentalContractId,
            );
            payment.invoiceId = new Types.ObjectId(invoiceId);
        }

        payment.status = RentalPaymentStatus.SUCCEEDED;
        payment.verifiedBy = new Types.ObjectId(String(accountant._id));
        payment.verifiedAt = new Date();
        payment.paymentMethodNote = dto.paymentMethodNote ?? payment.paymentMethodNote;

        await payment.save();

        if (dto.resendNotification !== false) {
            await this.notifyPaymentSuccess(rental, payment);
        }

        return payment;
    }

    /**
     * Builds and validates a Stripe webhook event from raw payload and signature header.
     */
    constructStripeEvent(rawBody: Buffer, signature?: string): Stripe.Event {
        if (!this.stripe || !this.stripeWebhookSecret) {
            throw new BadRequestException('Stripe webhook is not configured');
        }

        if (!signature) throw new BadRequestException('Missing Stripe signature');
        return this.stripe.webhooks.constructEvent(rawBody, signature, this.stripeWebhookSecret);
    }

    /**
     * Dispatches Stripe webhook events to payment success/failure handlers.
     */
    async handleStripeEvent(event: Stripe.Event): Promise<void> {
        if (event.type === 'payment_intent.succeeded') {
            const intent = event.data.object as Stripe.PaymentIntent;
            await this.handlePaymentSucceeded(intent);
        }

        if (event.type === 'payment_intent.payment_failed') {
            const intent = event.data.object as Stripe.PaymentIntent;
            await this.handlePaymentFailed(intent);
        }
    }

    /**
     * Handles Stripe success by marking payment paid, creating invoice, and advancing rental due date.
     */
    private async handlePaymentSucceeded(intent: Stripe.PaymentIntent): Promise<void> {
        const payment = await this.rentalPaymentModel.findOne({ stripePaymentIntentId: intent.id }).exec();
        if (!payment) return;

        if (payment.status === RentalPaymentStatus.SUCCEEDED && payment.invoiceId) {
            return;
        }

        payment.status = RentalPaymentStatus.SUCCEEDED;
        payment.paidAt = new Date();
        payment.stripeChargeId = intent.latest_charge?.toString();

        const rental = await this.rentalModel.findById(payment.rentalId).exec();
        if (!rental) return;

        const invoiceId = await this.ensureInvoiceForSucceededPayment(rental, payment);
        payment.invoiceId = new Types.ObjectId(invoiceId);
        await payment.save();

        await this.refreshRentalPaymentProgress(rental, payment);

        await this.notifyPaymentSuccess(rental, payment);
    }

    /**
     * Handles Stripe failure by marking payment status as failed.
     */
    private async handlePaymentFailed(intent: Stripe.PaymentIntent): Promise<void> {
        const payment = await this.rentalPaymentModel.findOne({ stripePaymentIntentId: intent.id }).exec();
        if (!payment) return;
        payment.status = RentalPaymentStatus.FAILED;
        await payment.save();
    }

    /**
     * Resolves tenant id from explicit input or latest approved application for the property.
     */
    private async resolveTenantId(propertyId: string, tenantId?: string): Promise<string> {
        if (tenantId) return tenantId;

        const application = await this.applicationModel
            .findOne({
                propertyId: new Types.ObjectId(propertyId),
                status: ApplicationStatus.APPROVED,
            })
            .sort({ createdAt: -1 })
            .exec();

        if (!application) {
            throw new BadRequestException('tenantId is required when no approved application exists');
        }

        return application.clientId.toString();
    }

    /**
     * Sends payment success notification to owner, tenant, and agent recipients.
     */
    private async notifyPaymentSuccess(rental: RentalDocument, payment: RentalPaymentDocument): Promise<void> {
        const owner = await this.userModel.findById(rental.ownerId).exec();
        const tenant = await this.userModel.findById(rental.tenantId).exec();
        const agent = rental.agentId ? await this.userModel.findById(rental.agentId).exec() : null;

        const recipients = [owner?.email, tenant?.email, agent?.email].filter((email): email is string => !!email);
        if (recipients.length === 0) return;

        if (!payment.invoiceId) {
            throw new InternalServerErrorException(`Succeeded payment ${payment._id} is missing invoiceId`);
        }

        const invoice = await this.financeService.findOne(payment.invoiceId.toString());
        const invoiceNumber = invoice.invoiceNumber ?? payment.invoiceId.toString();
        const billingLabel = `${payment.billingPeriodStart.toISOString().slice(0, 10)} to ${payment.billingPeriodEnd.toISOString().slice(0, 10)}`;
        const invoicePdfUrl = invoice.pdfUrl ?? '';

        const subject = `Rental payment confirmed - Invoice ${invoiceNumber}`;
        const body = [
            `A rental payment has been confirmed with status ${payment.status}.`,
            `Invoice: ${invoiceNumber}`,
            `Payment amount: ${payment.amount} ${payment.currency.toUpperCase()}`,
            `Billing period: ${billingLabel}`,
            `Breakdown -> Rent: ${Number(payment.rentAmount ?? 0)} EUR, Agency fee: ${Number(payment.agencyFeeAmount ?? 0)} EUR, Deposit: ${Number(payment.depositAmount ?? 0)} EUR.`,
            `Invoice id: ${payment.invoiceId.toString()}`,
            invoicePdfUrl ? `Invoice PDF: ${invoicePdfUrl}` : 'Invoice PDF: pending',
        ].join(' ');

        await Promise.all(
            recipients.map((email) =>
                this.mailService.sendRentalPaymentEmail(email, subject, body),
            ),
        );
    }

    /**
     * Ensures every succeeded payment is linked to an invoice.
     */
    private async ensureInvoiceForSucceededPayment(
        rental: RentalDocument,
        payment: RentalPaymentDocument,
        accountantId?: string,
        rentalContractId?: string,
    ): Promise<string> {
        const invoiceId = await this.createInvoiceForPayment(rental, payment, accountantId, rentalContractId);
        if (!invoiceId) {
            throw new InternalServerErrorException(
                `Failed to create invoice for succeeded payment ${payment._id}`,
            );
        }

        return invoiceId;
    }

    /**
     * Temporary bypass while webhook is unstable: mark Stripe payment succeeded on create.
     */
    private async maybeForceStripeSuccessOnCreate(
        rental: RentalDocument,
        payment: RentalPaymentDocument,
    ): Promise<void> {
        if (!this.forceStripeSucceededOnCreate) {
            return;
        }

        if (payment.status === RentalPaymentStatus.SUCCEEDED && payment.invoiceId) {
            return;
        }

        payment.status = RentalPaymentStatus.SUCCEEDED;
        payment.paidAt = new Date();
        payment.stripeChargeId = payment.stripeChargeId ?? `manual-bypass-${Date.now()}`;

        const invoiceId = await this.ensureInvoiceForSucceededPayment(rental, payment);
        payment.invoiceId = new Types.ObjectId(invoiceId);
        await payment.save();

        await this.refreshRentalPaymentProgress(rental, payment);
        await this.notifyPaymentSuccess(rental, payment);
    }

    // ═══════════════════════════════════════════════════════════════════════════════════
    // SCENARIO 1: Multi-Month Bulk Payment (Client A pays 5 months upfront)
    // ═══════════════════════════════════════════════════════════════════════════════════
    async createMultiMonthPayment(
        rentalId: string,
        monthsCount: number,
        startFromMonth?: Date,
    ): Promise<{ clientSecret: string; paymentId: string; coveredMonths: number }> {
        if (!this.stripe) throw new BadRequestException('Stripe is not configured');
        if (monthsCount < 2) throw new BadRequestException('Multi-month payment must cover 2+ months');

        const rental = await this.rentalModel.findById(rentalId).exec();
        if (!rental) throw new NotFoundException('Rental not found');

        const listing = await this.listingModel.findById(rental.propertyListingId).exec();
        if (!listing) throw new NotFoundException('Property listing not found');

        // Period start/end
        const baseDate = startFromMonth ?? rental.nextPaymentDue ?? rental.moveInDate ?? new Date();
        const periodStart = this.getMonthStart(baseDate);
        const periodEnd = this.addMonths(periodStart, monthsCount);
        const breakdown = this.getDueBreakdownForPeriod(rental, listing, periodStart, monthsCount);

        const totalAmount = breakdown.totalDue;

        console.log(`💳 [createMultiMonthPayment] Bulk payment for ${monthsCount} month(s): ${totalAmount} EUR`);
        console.log(`   Period: ${periodStart.toISOString()} to ${periodEnd.toISOString()}`);

        const normalizedCurrency = 'eur';
        const amountInSmallestUnit = Math.round(totalAmount * 100);

        const intent = await this.stripe.paymentIntents.create({
            amount: amountInSmallestUnit,
            currency: normalizedCurrency,
            metadata: {
                rentalId: rental._id.toString(),
                propertyId: rental.propertyId.toString(),
                isMultiMonth: 'true',
                monthsCount: monthsCount.toString(),
                rentAmount: breakdown.rentAmount.toFixed(2),
                agencyFeeAmount: breakdown.agencyFeeAmount.toFixed(2),
                depositAmount: breakdown.depositAmount.toFixed(2),
            },
            automatic_payment_methods: { enabled: true },
        });

        const payment = await this.rentalPaymentModel.create({
            rentalId: rental._id,
            amount: totalAmount,
            rentAmount: breakdown.rentAmount,
            agencyFeeAmount: breakdown.agencyFeeAmount,
            depositAmount: breakdown.depositAmount,
            totalDueForPeriod: breakdown.totalDue,
            isInitialPaymentPeriod: breakdown.isInitialPaymentPeriod,
            coveredMonths: monthsCount,
            currency: normalizedCurrency,
            paymentMethod: RentalPaymentMethod.STRIPE,
            stripePaymentIntentId: intent.id,
            status: RentalPaymentStatus.PENDING,
            billingPeriodStart: periodStart,
            billingPeriodEnd: periodEnd,
            isMultiMonth: true,
            trancheNumber: 1,
        });

        if (!intent.client_secret) {
            throw new BadRequestException('Stripe client secret missing');
        }

        await this.maybeForceStripeSuccessOnCreate(rental, payment);

        return {
            clientSecret: intent.client_secret,
            paymentId: payment._id.toString(),
            coveredMonths: monthsCount,
        };
    }

    // ═══════════════════════════════════════════════════════════════════════════════════
    // SCENARIO 2: Multi-Tranche Payment (Client B pays 1 month in 3 tranches)
    // ═══════════════════════════════════════════════════════════════════════════════════
    async createTranchedPayment(
        rentalId: string,
        trancheAmount: number,
        trancheNumber: number,
        forMonth?: Date,
    ): Promise<{ clientSecret: string; paymentId: string; trancheInfo: string }> {
        if (!this.stripe) throw new BadRequestException('Stripe is not configured');
        if (trancheAmount <= 0) throw new BadRequestException('Tranche amount must be > 0');
        if (trancheNumber < 1) throw new BadRequestException('Tranche number must be >= 1');

        const rental = await this.rentalModel.findById(rentalId).exec();
        if (!rental) throw new NotFoundException('Rental not found');

        const listing = await this.listingModel.findById(rental.propertyListingId).exec();
        if (!listing) throw new NotFoundException('Property listing not found');

        // Period for this tranche
        const baseDate = forMonth ?? rental.nextPaymentDue ?? rental.moveInDate ?? new Date();
        const periodStart = this.getMonthStart(baseDate);
        const periodEnd = this.addMonths(periodStart, 1);
        const dueBreakdown = await this.getOutstandingBreakdownForSinglePeriod(
            rental,
            listing,
            periodStart,
            periodEnd,
        );
        const allocation = this.allocatePaymentAmount(trancheAmount, dueBreakdown);

        console.log(`💳 [createTranchedPayment] Tranche #${trancheNumber} for month starting ${periodStart.toISOString()}: ${trancheAmount} EUR`);

        const normalizedCurrency = 'eur';
        const amountInSmallestUnit = Math.round(trancheAmount * 100);

        const intent = await this.stripe.paymentIntents.create({
            amount: amountInSmallestUnit,
            currency: normalizedCurrency,
            metadata: {
                rentalId: rental._id.toString(),
                propertyId: rental.propertyId.toString(),
                isTrached: 'true',
                trancheNumber: trancheNumber.toString(),
                rentAmount: allocation.rentAmount.toFixed(2),
                agencyFeeAmount: allocation.agencyFeeAmount.toFixed(2),
                depositAmount: allocation.depositAmount.toFixed(2),
            },
            automatic_payment_methods: { enabled: true },
        });

        const payment = await this.rentalPaymentModel.create({
            rentalId: rental._id,
            amount: trancheAmount,
            rentAmount: allocation.rentAmount,
            agencyFeeAmount: allocation.agencyFeeAmount,
            depositAmount: allocation.depositAmount,
            totalDueForPeriod: dueBreakdown.totalDue,
            isInitialPaymentPeriod: dueBreakdown.isInitialPaymentPeriod,
            coveredMonths: 1,
            currency: normalizedCurrency,
            paymentMethod: RentalPaymentMethod.STRIPE,
            stripePaymentIntentId: intent.id,
            status: RentalPaymentStatus.PENDING,
            billingPeriodStart: periodStart,
            billingPeriodEnd: periodEnd,
            isMultiMonth: false,
            trancheNumber,
        });

        if (!intent.client_secret) {
            throw new BadRequestException('Stripe client secret missing');
        }

        await this.maybeForceStripeSuccessOnCreate(rental, payment);

        return {
            clientSecret: intent.client_secret,
            paymentId: payment._id.toString(),
            trancheInfo: `Tranche ${trancheNumber} of month ${periodStart.toLocaleDateString()} - ${trancheAmount} EUR`,
        };
    }

    // ═══════════════════════════════════════════════════════════════════════════════════
    // Get Payment Status for a Specific Period
    // ═══════════════════════════════════════════════════════════════════════════════════
    async getPaymentStatusForPeriod(
        rentalId: string,
        periodStart: Date,
        periodEnd: Date,
    ): Promise<{
        status: 'PAID' | 'UNPAID' | 'OVERDUE' | 'PARTIAL';
        totalPaid: number;
        totalDue: number;
        tranches: any[];
    }> {
        const rental = await this.rentalModel.findById(rentalId).exec();
        if (!rental) throw new NotFoundException('Rental not found');

        const listing = await this.listingModel.findById(rental.propertyListingId).exec();
        if (!listing) throw new NotFoundException('Property listing not found');

        // Find all payments that overlap this period (supports multi-month payments).
        const paymentsForPeriod = await this.rentalPaymentModel.find({
            rentalId: new Types.ObjectId(rentalId),
            billingPeriodStart: { $lt: periodEnd },
            billingPeriodEnd: { $gt: periodStart },
        }).populate('invoiceId', 'invoiceNumber status total paid date signatureUrl pdfUrl pdfPublicId').exec();

        // Calculate totals
        const successfulPayments = paymentsForPeriod.filter(
            (p) => p.status === RentalPaymentStatus.SUCCEEDED || p.status === RentalPaymentStatus.VERIFIED,
        );
        const dueBreakdown = this.getDueBreakdownForPeriod(rental, listing, periodStart, 1);
        const totalDue = dueBreakdown.totalDue;

        const totalPaid = successfulPayments.reduce((sum, payment) => {
            const contribution = this.getPaymentContributionForMonth(payment, periodStart);
            return sum + contribution.allocatedTotal;
        }, 0);

        // Determine status
        const now = new Date();
        let status: 'PAID' | 'UNPAID' | 'OVERDUE' | 'PARTIAL';

        if (totalPaid >= totalDue) {
            status = 'PAID';
        } else if (totalPaid > 0) {
            status = 'PARTIAL';
        } else if (now > periodEnd) {
            status = 'OVERDUE';
        } else {
            status = 'UNPAID';
        }

        console.log(`📊 [getPaymentStatusForPeriod] ${periodStart.toISOString()}: ${status} (${totalPaid}/${totalDue} EUR, ${paymentsForPeriod.length} tranches)`);

        return {
            status,
            totalPaid,
            totalDue,
            tranches: paymentsForPeriod.map(p => ({
                amount: p.amount,
                status: p.status,
                trancheNumber: p.trancheNumber,
                paidAt: p.paidAt,
                rentAmount: p.rentAmount ?? p.amount,
                agencyFeeAmount: p.agencyFeeAmount ?? 0,
                depositAmount: p.depositAmount ?? 0,
                coveredMonths: p.coveredMonths ?? 1,
                invoiceId: p.invoiceId,
            })),
        };
    }

    // ═══════════════════════════════════════════════════════════════════════════════════
    // Helper: Get first day of a month
    // ═══════════════════════════════════════════════════════════════════════════════════
    private getMonthStart(date: Date): Date {
        const d = new Date(date);
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    /**
     * Returns rent amount from listing fees when provided, otherwise falls back to listing.price.
     */
    private getListingRentAmount(listing: PropertyListingDocument): number {
        const feesRentAmount = Number((listing as any)?.fees?.rentAmount ?? 0);
        if (feesRentAmount > 0) {
            return feesRentAmount;
        }

        return Number((listing as any)?.price ?? 0);
    }

    /**
     * Returns agency fees configured on the listing.
     */
    private getListingAgencyFee(listing: PropertyListingDocument): number {
        const agencyFee = Number((listing as any)?.fees?.agencyFees ?? 0);
        return agencyFee > 0 ? agencyFee : 0;
    }

    /**
     * Returns fixed security deposit from listing or computes it from depositMonths * monthly rent.
     */
    private getListingDepositAmount(listing: PropertyListingDocument, monthlyRent: number): number {
        const fixedDeposit = Number((listing as any)?.fees?.depositAmount ?? 0);
        if (fixedDeposit > 0) {
            return fixedDeposit;
        }

        const depositMonths = Number((listing as any)?.contractPolicies?.depositMonths ?? 0);
        if (depositMonths > 0) {
            return monthlyRent * depositMonths;
        }

        return 0;
    }

    /**
     * Determines the initial billing period month for a rental lifecycle.
     */
    private getInitialBillingPeriodStart(rental: RentalDocument): Date {
        const baseDate = rental.moveInDate
            ?? rental.contractSignedAt
            ?? (rental as any).createdAt
            ?? rental.nextPaymentDue
            ?? new Date();

        return this.getMonthStart(baseDate);
    }

    /**
     * Deposit is required only for the initial billing period.
     */
    private isDepositRequiredForPeriod(rental: RentalDocument, periodStart: Date): boolean {
        const initialPeriodStart = this.getInitialBillingPeriodStart(rental);
        return this.isSameBillingMonth(periodStart, initialPeriodStart);
    }

    /**
     * Computes due breakdown for a period before considering previously paid amounts.
     */
    private getDueBreakdownForPeriod(
        rental: RentalDocument,
        listing: PropertyListingDocument,
        periodStart: Date,
        coveredMonths = 1,
    ): PaymentBreakdown {
        const normalizedCoveredMonths = Math.max(1, Number(coveredMonths || 1));
        const monthlyRent = this.getListingRentAmount(listing);
        const agencyFee = this.getListingAgencyFee(listing);
        const depositAmount = this.getListingDepositAmount(listing, monthlyRent);
        const includeDeposit = this.isDepositRequiredForPeriod(rental, periodStart);

        // Business rule: each billing month includes rent + agency fee; deposit remains one-time on initial period.
        const rentAmount = monthlyRent * normalizedCoveredMonths;
        const agencyFeeAmount = agencyFee * normalizedCoveredMonths;
        const depositDueAmount = includeDeposit ? depositAmount : 0;

        return {
            rentAmount,
            agencyFeeAmount,
            depositAmount: depositDueAmount,
            totalDue: rentAmount + agencyFeeAmount + depositDueAmount,
            isInitialPaymentPeriod: includeDeposit,
            coveredMonths: normalizedCoveredMonths,
        };
    }

    /**
     * Computes remaining due for one month by subtracting successful/verified contributions.
     */
    private async getOutstandingBreakdownForSinglePeriod(
        rental: RentalDocument,
        listing: PropertyListingDocument,
        periodStart: Date,
        periodEnd: Date,
    ): Promise<PaymentBreakdown> {
        const due = this.getDueBreakdownForPeriod(rental, listing, periodStart, 1);
        const paid = await this.getPaidBreakdownForSinglePeriod(rental._id.toString(), periodStart, periodEnd);
        const remainingTotal = Math.max(0, due.totalDue - paid.allocatedTotal);
        const normalizedOutstanding = this.allocatePaymentAmount(remainingTotal, due);

        return {
            ...due,
            rentAmount: this.round2(normalizedOutstanding.rentAmount),
            agencyFeeAmount: this.round2(normalizedOutstanding.agencyFeeAmount),
            depositAmount: this.round2(normalizedOutstanding.depositAmount),
            totalDue: this.round2(remainingTotal),
            coveredMonths: 1,
        };
    }

    /**
     * Aggregates already paid breakdown for one month.
     */
    private async getPaidBreakdownForSinglePeriod(
        rentalId: string,
        periodStart: Date,
        periodEnd: Date,
    ): Promise<PaymentAllocation> {
        const paidPayments = await this.rentalPaymentModel.find({
            rentalId: new Types.ObjectId(rentalId),
            billingPeriodStart: { $lt: periodEnd },
            billingPeriodEnd: { $gt: periodStart },
            status: { $in: [RentalPaymentStatus.SUCCEEDED, RentalPaymentStatus.VERIFIED] },
        }).exec();

        return paidPayments.reduce((acc, payment) => {
            const contribution = this.getPaymentContributionForMonth(payment, periodStart);
            acc.rentAmount += contribution.rentAmount;
            acc.agencyFeeAmount += contribution.agencyFeeAmount;
            acc.depositAmount += contribution.depositAmount;
            acc.allocatedTotal += contribution.allocatedTotal;
            return acc;
        }, {
            rentAmount: 0,
            agencyFeeAmount: 0,
            depositAmount: 0,
            allocatedTotal: 0,
        });
    }

    /**
     * Allocates a payment amount on outstanding components with fixed charges first.
     */
    private allocatePaymentAmount(amount: number, outstanding: PaymentBreakdown): PaymentAllocation {
        let remaining = Math.max(0, Number(amount || 0));

        const depositAmount = Math.min(remaining, Math.max(0, outstanding.depositAmount));
        remaining -= depositAmount;

        const agencyFeeAmount = Math.min(remaining, Math.max(0, outstanding.agencyFeeAmount));
        remaining -= agencyFeeAmount;

        const rentOutstanding = Math.max(0, outstanding.rentAmount);
        const rentAmount = Math.min(remaining, rentOutstanding) + Math.max(0, remaining - rentOutstanding);

        const allocatedTotal = depositAmount + agencyFeeAmount + rentAmount;
        return {
            rentAmount: this.round2(rentAmount),
            agencyFeeAmount: this.round2(agencyFeeAmount),
            depositAmount: this.round2(depositAmount),
            allocatedTotal: this.round2(allocatedTotal),
        };
    }

    /**
     * Compares two dates at billing-month granularity.
     */
    private isSameBillingMonth(left: Date, right: Date): boolean {
        return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
    }

    /**
     * Converts one payment to its monetary contribution for a target month (handles bulk coverage).
     */
    private getPaymentContributionForMonth(payment: RentalPaymentDocument, monthStart: Date): PaymentAllocation {
        const normalizedMonthStart = this.getMonthStart(monthStart);
        const coveredMonths = this.getCoveredMonths(payment);
        const paymentStart = this.getMonthStart(payment.billingPeriodStart);
        const monthOffset = this.getMonthDiff(paymentStart, normalizedMonthStart);

        if (monthOffset < 0 || monthOffset >= coveredMonths) {
            return {
                rentAmount: 0,
                agencyFeeAmount: 0,
                depositAmount: 0,
                allocatedTotal: 0,
            };
        }

        const explicitRent = Number(payment.rentAmount ?? 0);
        const explicitAgency = Number(payment.agencyFeeAmount ?? 0);
        const explicitDeposit = Number(payment.depositAmount ?? 0);
        const hasExplicitBreakdown = explicitRent > 0 || explicitAgency > 0 || explicitDeposit > 0;

        const fallbackRent = Number(payment.amount ?? 0);
        const totalRent = hasExplicitBreakdown ? explicitRent : fallbackRent;
        const monthlyRentShare = coveredMonths > 0 ? totalRent / coveredMonths : totalRent;
        const agencyForMonth = monthOffset === 0 ? explicitAgency : 0;
        const depositForMonth = monthOffset === 0 ? explicitDeposit : 0;
        const allocatedTotal = monthlyRentShare + agencyForMonth + depositForMonth;

        return {
            rentAmount: this.round2(monthlyRentShare),
            agencyFeeAmount: this.round2(agencyForMonth),
            depositAmount: this.round2(depositForMonth),
            allocatedTotal: this.round2(allocatedTotal),
        };
    }

    /**
     * Returns true when a payment period overlaps with a target month period.
     */
    private isPaymentOverlappingMonth(payment: RentalPaymentDocument, monthStart: Date, monthEnd: Date): boolean {
        return payment.billingPeriodStart < monthEnd && payment.billingPeriodEnd > monthStart;
    }

    private getCoveredMonths(payment: RentalPaymentDocument): number {
        const explicit = Number(payment.coveredMonths ?? 0);
        if (explicit > 0) {
            return Math.max(1, Math.round(explicit));
        }

        if (payment.isMultiMonth) {
            const diff = this.getMonthDiff(this.getMonthStart(payment.billingPeriodStart), this.getMonthStart(payment.billingPeriodEnd));
            return Math.max(1, diff);
        }

        return 1;
    }

    private getMonthDiff(from: Date, to: Date): number {
        return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
    }

    private round2(value: number): number {
        return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
    }

    private async resolveAccountantContext(requester: AuthenticatedUserContext): Promise<UserDocument> {
        const userId = requester?.userId;
        if (!userId) {
            throw new ForbiddenException('Authenticated accountant user is required');
        }

        const user = await this.userModel.findById(userId).exec();
        if (!user || user.role !== UserRole.ACCOUNTANT) {
            throw new ForbiddenException('Only accountants can perform this operation');
        }

        if (!user.branchId) {
            throw new ForbiddenException('Accountant must be assigned to a branch');
        }

        return user;
    }

    private async assertAccountantCanAccessRental(rental: RentalDocument, requester: AuthenticatedUserContext): Promise<void> {
        const accountant = await this.resolveAccountantContext(requester);
        const rentalBranchId = String(rental.branchId ?? '');

        if (!rentalBranchId || rentalBranchId !== String(accountant.branchId)) {
            throw new ForbiddenException('Rental does not belong to your branch');
        }
    }

    private async assertRentalTrackingAccess(rental: RentalDocument, requester: AuthenticatedUserContext): Promise<void> {
        const userId = String(requester?.userId ?? '');
        if (!userId) {
            throw new ForbiddenException('Authentication required');
        }

        if (requester.role === UserRole.ACCOUNTANT) {
            await this.assertAccountantCanAccessRental(rental, requester);
            return;
        }

        if (this.isParticipantUser(rental, userId)) {
            return;
        }

        throw new ForbiddenException('You do not have access to this rental payment tracking');
    }

    private isParticipantUser(rental: RentalDocument, userId: string): boolean {
        return [rental.ownerId, rental.tenantId, rental.agentId]
            .filter(Boolean)
            .map((id) => String(id))
            .includes(String(userId));
    }

    /**
     * Adds a month offset to a date while keeping JS Date rollover behavior.
     */
    private addMonths(base: Date, months: number): Date {
        const date = new Date(base);
        date.setMonth(date.getMonth() + months);
        return date;
    }

    /**
     * Updates rental financial progression after a successful/verified payment.
     */
    private async refreshRentalPaymentProgress(rental: RentalDocument, payment: RentalPaymentDocument): Promise<void> {
        rental.lastPaymentDate = new Date();
        rental.outstandingBalance = Math.max(0, (rental.outstandingBalance ?? 0) - payment.amount);

        const coveredMonths = this.getCoveredMonths(payment);
        if (coveredMonths > 1) {
            rental.nextPaymentDue = payment.billingPeriodEnd;
            await rental.save();
            return;
        }

        const monthStatus = await this.getPaymentStatusForPeriod(
            rental._id.toString(),
            payment.billingPeriodStart,
            payment.billingPeriodEnd,
        );

        if (monthStatus.status === 'PAID') {
            rental.nextPaymentDue = payment.billingPeriodEnd;
        }

        await rental.save();
    }

    /**
     * Creates and links an invoice for a paid rental payment, avoiding duplicate invoices.
     */
    private async createInvoiceForPayment(
        rental: RentalDocument,
        payment: RentalPaymentDocument,
        accountantId?: string,
        rentalContractId?: string,
    ): Promise<string | null> {
        try {
            if (payment.invoiceId) {
                return payment.invoiceId.toString();
            }

            const tenant = await this.userModel.findById(rental.tenantId).exec();
            const property = await this.propertyModel.findById(rental.propertyId).exec();
            let resolvedRentalContractId = rentalContractId;

            if (!resolvedRentalContractId) {
                const latestContract = await this.contractModel
                    .findOne({ rentalId: rental._id })
                    .sort({ version: -1, createdAt: -1 })
                    .exec();
                if (latestContract) {
                    resolvedRentalContractId = latestContract._id.toString();
                }
            }

            const invoice = await this.financeService.createInvoiceFromRentalPayment({
                accountantId,
                rentalId: rental._id.toString(),
                rentalPaymentId: payment._id.toString(),
                rentalBranchId: rental.branchId,
                rentalContractId: resolvedRentalContractId,
                amount: payment.amount,
                billingPeriodStart: payment.billingPeriodStart,
                billingPeriodEnd: payment.billingPeriodEnd,
                clientName: tenant?.fullName ?? 'Rental Tenant',
                clientAddress: property?.address ?? 'N/A',
                paymentMethod: payment.paymentMethod,
                paymentBreakdown: {
                    rentAmount: Number(payment.rentAmount ?? payment.amount),
                    agencyFeeAmount: Number(payment.agencyFeeAmount ?? 0),
                    depositAmount: Number(payment.depositAmount ?? 0),
                    coveredMonths: Number(payment.coveredMonths ?? 1),
                },
                paymentMethodNote: payment.paymentMethodNote,
            });

            await this.propertyModel.findByIdAndUpdate(
                rental.propertyId,
                {
                    $push: { invoiceIds: invoice._id },
                    $set: { latestInvoiceId: invoice._id },
                },
            ).exec();

            return invoice._id.toString();
        } catch (error) {
            console.error(`Failed to create invoice for payment ${payment._id}:`, error);
            return null;
        }
    }

    /**
     * ✅ AUTO-CREATE DEFAULT CONTRACT when rental transitions to 'rented'
     * Generates placeholder contract URL for manual upload later
     */
    private async createDefaultContractForRental(rental: RentalDocument): Promise<void> {
        try {
            // Check if contract already exists
            const existingContract = await this.contractModel.findOne({
                rentalId: rental._id,
            }).exec();

            if (existingContract) {
                console.log(`Contract already exists for rental ${rental._id}`);
                return;
            }

            // Create default contract with placeholder URL
            const systemUserId = new Types.ObjectId('000000000000000000000001');  // System user
            const moveOutDate = rental.moveOutDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);  // Default 1 year
            const expiryDate = new Date(moveOutDate);
            expiryDate.setFullYear(expiryDate.getFullYear() + 7);  // 7-year legal hold

            const contract = new this.contractModel({
                rentalId: rental._id,
                documentUrl: 'https://placeholder.example.com/contract-pending.pdf',  // Placeholder
                fileName: `rental_contract_${rental._id}.pdf`,
                version: 1,
                uploadedBy: systemUserId,
                expiresAt: expiryDate,
                notes: `Auto-created contract when rental transitioned to 'rented' on ${new Date().toISOString()}. Please upload actual contract.`,
            });

            await contract.save();
            console.log(`✅ Contract auto-created for rental ${rental._id}`);

            // Send notification to owner
            if (rental.ownerId) {
                const owner = await this.userModel.findById(rental.ownerId).exec();
                if (owner?.email) {
                    await this.mailService.sendMail({
                        to: owner.email,
                        subject: 'Rental Contract Created - Action Required',
                        html: `
                            <p>Hello ${owner.fullName},</p>
                            <p>A default contract has been created for rental ${rental._id}.</p>
                            <p>Please upload the signed contract PDF.</p>
                            <p>Property ID: ${rental.propertyId}</p>
                        `,
                    }).catch(err => console.error('Failed to send contract notification:', err));
                }
            }
        } catch (error) {
            console.error(`Failed to auto-create contract for rental ${rental._id}:`, error);
            // Don't throw - allow rental update to succeed even if contract creation fails
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════════════
    // AUTOMATED PAYMENT REMINDERS - Called by Scheduler daily at 9 AM
    // ═══════════════════════════════════════════════════════════════════════════════════
    async sendPaymentReminders(): Promise<void> {
        console.log('📧 [RentalService] Starting payment reminder distribution...');

        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Reminder window: Send reminders for payments due in next 3 days
            const reminderWindow = new Date(today);
            reminderWindow.setDate(reminderWindow.getDate() + 3);
            reminderWindow.setHours(23, 59, 59, 999);

            // Find active rentals with payment due soon
            const rentalsWithUpcomingPayments = await this.rentalModel
                .find({
                    status: 'rented',
                    nextPaymentDue: {
                        $gte: today,
                        $lte: reminderWindow,
                    },
                })
                .populate('tenantId', 'fullName email')
                .populate('propertyId', 'address title')
                .populate('propertyListingId', 'price')
                .exec();

            console.log(`🔍 Found ${rentalsWithUpcomingPayments.length} rental(s) with upcoming payment(s)`);

            let sentCount = 0;

            for (const rental of rentalsWithUpcomingPayments) {
                try {
                    // Get tenant and listing info
                    const tenant = rental.tenantId as any;
                    const property = rental.propertyId as any;
                    const listing = rental.propertyListingId as any;

                    if (!tenant?.email) {
                        console.log(`⚠️  Skipping rental ${rental._id}: Tenant email not found`);
                        continue;
                    }

                    const monthlyRent = listing?.price ?? 0;
                    const daysUntilDue = Math.ceil(
                        (rental.nextPaymentDue!.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
                    );

                    // Send HTML email
                    await this.mailService.sendMail({
                        to: tenant.email,
                        subject: `Rent Payment Reminder - Due in ${daysUntilDue} day(s)`,
                        html: `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa; border-radius: 10px;">
                                <div style="background: #064A7E; padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
                                    <h1 style="color: white; margin: 0; font-size: 24px;">🏠 SmartProperty</h1>
                                </div>
                                
                                <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                                    <h2 style="color: #064A7E; margin-top: 0;">Payment Reminder</h2>
                                    
                                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                                        Hello <strong>${tenant.fullName}</strong>,
                                    </p>

                                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                                        This is a friendly reminder that your rent payment is due <strong>in ${daysUntilDue} day(s)</strong>.
                                    </p>

                                    <div style="background: #f0f7ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #064A7E;">
                                        <h3 style="color: #064A7E; margin-top: 0;">💰 Payment Details:</h3>
                                        <table style="width: 100%; border-collapse: collapse;">
                                            <tr>
                                                <td style="padding: 8px 0; color: #666; font-weight: bold;">Property:</td>
                                                <td style="padding: 8px 0; color: #333;">${property?.title || property?.address || 'N/A'}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; color: #666; font-weight: bold;">Amount Due:</td>
                                                <td style="padding: 8px 0; color: #333; font-size: 18px;"><strong>€${monthlyRent.toFixed(2)}</strong></td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; color: #666; font-weight: bold;">Due Date:</td>
                                                <td style="padding: 8px 0; color: #333;">${rental.nextPaymentDue!.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td>
                                            </tr>
                                        </table>
                                    </div>

                                    <div style="text-align: center; margin: 30px 0;">
                                        <a href="https://smartproperty.app/tenant/payments" style="background: #064A7E; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; display: inline-block;">
                                            Make Payment
                                        </a>
                                    </div>

                                    <p style="color: #666; font-size: 14px; margin-top: 30px;">
                                        <strong>Payment Options:</strong>
                                        <br>• 💳 Stripe (Credit/Debit Card)
                                        <br>• 💵 Cash (with proof upload)
                                        <br>• 🏦 Cheque (with details submission)
                                    </p>

                                    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                                    
                                    <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
                                        If you have any questions or need assistance, please contact property management.
                                        <br>© ${new Date().getFullYear()} SmartProperty. All rights reserved.
                                    </p>
                                </div>
                            </div>
                        `,
                    });

                    sentCount++;
                    console.log(`✅ Payment reminder sent to ${tenant.email} for rental ${rental._id} (due in ${daysUntilDue} days)`);
                } catch (error: unknown) {
                    const msg = error instanceof Error ? error.message : String(error);
                    console.error(`❌ Failed to send reminder for rental ${rental._id}: ${msg}`);
                }
            }

            console.log(`📧 [RentalService] Payment reminders completed. Sent ${sentCount}/${rentalsWithUpcomingPayments.length}`);
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            console.error('[RentalService] Payment reminder error:', msg);
        }
    }
}
