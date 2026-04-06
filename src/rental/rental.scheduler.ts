import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Rental, RentalDocument } from './schemas/rental.schema';
import { Property, PropertyDocument, PropertyStatus } from '../property/schemas/property.schema';
import { RentalService } from './rental.service';

@Injectable()
export class RentalScheduler {
    private readonly logger = new Logger(RentalScheduler.name);

    constructor(
        @InjectModel(Rental.name) private rentalModel: Model<RentalDocument>,
        @InjectModel(Property.name) private propertyModel: Model<PropertyDocument>,
        private readonly rentalService: RentalService,
    ) { }

    /**
     * Scheduled task that runs daily at midnight (00:00).
     * Finds all expired rentals (moveOutDate < today) and auto-reverts
     * the linked properties to RENTAL_ENDED status.
     * 
     * Owners can then manually confirm readiness before the property
     * goes back to AVAILABLE.
     */
    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async handleExpiredRentals() {
        this.logger.log('🔄 [RentalScheduler] Starting expired rental check...');

        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Find rental agreements where moveOutDate has passed
            const expiredRentals = await this.rentalModel
                .find({
                    moveOutDate: { $lt: today },
                    // Optionally: exclude rentals already marked as ended
                })
                .exec();

            this.logger.log(`🔍 Found ${expiredRentals.length} expired rental(s)`);

            let processedCount = 0;

            for (const rental of expiredRentals) {
                try {
                    const property = await this.propertyModel.findByIdAndUpdate(
                        rental.propertyId,
                        {
                            status: PropertyStatus.RENTAL_ENDED,
                            updatedAt: new Date(),
                        },
                        { new: true },
                    ).exec();

                    if (property) {
                        processedCount++;
                        this.logger.log(
                            `✅ Property ${property._id} reverted to RENTAL_ENDED after rental expiry (moveOutDate: ${rental.moveOutDate})`,
                        );
                    }
                } catch (error: unknown) {
                    const msg = error instanceof Error ? error.message : String(error);
                    this.logger.error(
                        `❌ Failed to process rental ${rental._id}: ${msg}`,
                    );
                }
            }

            this.logger.log(
                `🔄 [RentalScheduler] Completed. Processed ${processedCount}/${expiredRentals.length} expired rentals`,
            );
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            this.logger.error('[RentalScheduler] Fatal error: ' + msg);
        }
    }

    /**
     * Scheduled task that runs daily at 9:00 AM (09:00).
     * Finds all active rentals with payments due in the next 3 days
     * and sends email payment reminders to tenants.
     */
    @Cron('0 9 * * *')  // Daily at 9 AM
    async sendDuePaymentReminders() {
        this.logger.log('📧 [RentalScheduler] Starting payment reminder check...');

        try {
            await this.rentalService.sendPaymentReminders();
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            this.logger.error('[RentalScheduler] Payment reminder error: ' + msg);
        }
    }
}
