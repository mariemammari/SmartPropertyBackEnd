import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';
import { Rental, RentalDocument } from './schemas/rental.schema';
import { RentalPayment, RentalPaymentDocument, RentalPaymentStatus } from './schemas/rental-payment.schema';
import { CreateRentalDto } from './dto/create-rental.dto';
import { UpdateRentalDto } from './dto/update-rental.dto';
import { Property, PropertyDocument, PropertyStatus, TransactionType } from '../property/schemas/property.schema';
import { PropertyListing, PropertyListingDocument, ListingStatus } from '../property-listing/schemas/property-listing.schema';
import { Application, ApplicationDocument, ApplicationStatus } from '../application/schemas/application.schema';
import { User, UserDocument } from '../user/schemas/user.schema';
import { MailService } from '../mail/mail.service';

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

@Injectable()
export class RentalService {
    private stripe: Stripe | null;
    private stripeWebhookSecret: string | null;

    constructor(
        private readonly configService: ConfigService,
        private readonly mailService: MailService,
        @InjectModel(Rental.name) private rentalModel: Model<RentalDocument>,
        @InjectModel(RentalPayment.name) private rentalPaymentModel: Model<RentalPaymentDocument>,
        @InjectModel(Property.name) private propertyModel: Model<PropertyDocument>,
        @InjectModel(PropertyListing.name) private listingModel: Model<PropertyListingDocument>,
        @InjectModel(Application.name) private applicationModel: Model<ApplicationDocument>,
        @InjectModel(User.name) private userModel: Model<UserDocument>,
    ) {
        const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY');
        this.stripeWebhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET') ?? null;
        this.stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: '2023-10-16' as any }) : null;
    }

    async create(dto: CreateRentalDto): Promise<Rental> {
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

    async update(id: string, dto: UpdateRentalDto): Promise<Rental> {
        const update: Record<string, any> = { ...dto };
        if (dto.tenantId) update.tenantId = new Types.ObjectId(dto.tenantId);
        if (dto.agentId) update.agentId = new Types.ObjectId(dto.agentId);

        const rental = await this.rentalModel.findByIdAndUpdate(id, update, { new: true }).exec();
        if (!rental) throw new NotFoundException('Rental not found');
        return rental;
    }

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

    async findByOwner(ownerId: string): Promise<Rental[]> {
        return this.rentalModel
            .find({ ownerId: new Types.ObjectId(ownerId) })
            .sort({ createdAt: -1 })
            .exec();
    }

    async findByTenant(tenantId: string): Promise<Rental[]> {
        return this.rentalModel
            .find({ tenantId: new Types.ObjectId(tenantId) })
            .sort({ createdAt: -1 })
            .exec();
    }

    async findByProperty(propertyId: string): Promise<Rental[]> {
        return this.rentalModel
            .find({ propertyId: new Types.ObjectId(propertyId) })
            .sort({ createdAt: -1 })
            .exec();
    }

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

        const amount = listing.price;
        const currency = 'tnd';
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

        const schedule = Array.from({ length: scheduleCount }).map((_, index) => ({
            dueDate: this.addMonths(startDate, index * frequency),
            amount,
        }));

        return {
            rentalId: rental._id.toString(),
            amount,
            currency,
            paymentFrequencyMonths: frequency,
            durationMonths: duration ?? undefined,
            estimated: !(duration && duration > 0),
            schedule,
        };
    }

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
            moveOutDate: { $exists: false },
        }).exec();
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
            moveOutDate: { $exists: false },
        }).exec();
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

    async createPaymentIntent(rentalId: string, amount?: number, currency?: string): Promise<{ clientSecret: string; paymentId: string }> {
        if (!this.stripe) throw new BadRequestException('Stripe is not configured');

        const rental = await this.rentalModel.findById(rentalId).exec();
        if (!rental) throw new NotFoundException('Rental not found');

        const listing = await this.listingModel.findById(rental.propertyListingId).exec();
        if (!listing) throw new NotFoundException('Property listing not found');

        const paymentAmount = amount ?? listing.price;
        if (paymentAmount <= 0) throw new BadRequestException('Payment amount must be greater than zero');

        const normalizedCurrency = (currency ?? 'tnd').toLowerCase();
        const amountInSmallestUnit = Math.round(paymentAmount * 100);

        const intent = await this.stripe.paymentIntents.create({
            amount: amountInSmallestUnit,
            currency: normalizedCurrency,
            metadata: {
                rentalId: rental._id.toString(),
                propertyId: rental.propertyId.toString(),
            },
            automatic_payment_methods: { enabled: true },
        });

        const payment = await this.rentalPaymentModel.create({
            rentalId: rental._id,
            amount: paymentAmount,
            currency: normalizedCurrency,
            stripePaymentIntentId: intent.id,
            status: RentalPaymentStatus.PENDING,
        });

        if (!intent.client_secret) {
            throw new BadRequestException('Stripe client secret missing');
        }

        return { clientSecret: intent.client_secret, paymentId: payment._id.toString() };
    }

    constructStripeEvent(rawBody: Buffer, signature?: string): Stripe.Event {
        if (!this.stripe || !this.stripeWebhookSecret) {
            throw new BadRequestException('Stripe webhook is not configured');
        }

        if (!signature) throw new BadRequestException('Missing Stripe signature');
        return this.stripe.webhooks.constructEvent(rawBody, signature, this.stripeWebhookSecret);
    }

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

    private async handlePaymentSucceeded(intent: Stripe.PaymentIntent): Promise<void> {
        const payment = await this.rentalPaymentModel.findOne({ stripePaymentIntentId: intent.id }).exec();
        if (!payment) return;

        payment.status = RentalPaymentStatus.SUCCEEDED;
        payment.paidAt = new Date();
        payment.stripeChargeId = intent.latest_charge?.toString();
        await payment.save();

        const rental = await this.rentalModel.findById(payment.rentalId).exec();
        if (!rental) return;

        rental.lastPaymentDate = new Date();
        if (rental.paymentFrequencyMonths && rental.paymentFrequencyMonths > 0) {
            const next = new Date();
            next.setMonth(next.getMonth() + rental.paymentFrequencyMonths);
            rental.nextPaymentDue = next;
        }
        rental.outstandingBalance = Math.max(0, (rental.outstandingBalance ?? 0) - payment.amount);
        await rental.save();

        await this.notifyPaymentSuccess(rental, payment.amount, payment.currency);
    }

    private async handlePaymentFailed(intent: Stripe.PaymentIntent): Promise<void> {
        const payment = await this.rentalPaymentModel.findOne({ stripePaymentIntentId: intent.id }).exec();
        if (!payment) return;
        payment.status = RentalPaymentStatus.FAILED;
        await payment.save();
    }

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

    private async notifyPaymentSuccess(rental: RentalDocument, amount: number, currency: string): Promise<void> {
        const owner = await this.userModel.findById(rental.ownerId).exec();
        const tenant = await this.userModel.findById(rental.tenantId).exec();
        const agent = rental.agentId ? await this.userModel.findById(rental.agentId).exec() : null;

        const recipients = [owner?.email, tenant?.email, agent?.email].filter((email): email is string => !!email);
        if (recipients.length === 0) return;

        const subject = 'Rental payment received';
        const body = `A rental payment of ${amount} ${currency.toUpperCase()} was received.`;

        await Promise.all(
            recipients.map((email) =>
                this.mailService.sendRentalPaymentEmail(email, subject, body),
            ),
        );
    }

    private addMonths(base: Date, months: number): Date {
        const date = new Date(base);
        date.setMonth(date.getMonth() + months);
        return date;
    }
}
