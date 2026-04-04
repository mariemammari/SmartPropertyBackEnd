import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { RentalService } from './rental.service';
import { RentalController } from './rental.controller';
import { Rental, RentalSchema } from './schemas/rental.schema';
import { RentalPayment, RentalPaymentSchema } from './schemas/rental-payment.schema';
import { Property, PropertySchema } from '../property/schemas/property.schema';
import { PropertyListing, PropertyListingSchema } from '../property-listing/schemas/property-listing.schema';
import { Application, ApplicationSchema } from '../application/schemas/application.schema';
import { User, UserSchema } from '../user/schemas/user.schema';
import { MailModule } from '../mail/mail.module';

@Module({
    imports: [
        ConfigModule,
        MailModule,
        MongooseModule.forFeature([
            { name: Rental.name, schema: RentalSchema },
            { name: RentalPayment.name, schema: RentalPaymentSchema },
            { name: Property.name, schema: PropertySchema },
            { name: PropertyListing.name, schema: PropertyListingSchema },
            { name: Application.name, schema: ApplicationSchema },
            { name: User.name, schema: UserSchema },
        ]),
    ],
    controllers: [RentalController],
    providers: [RentalService],
    exports: [RentalService],
})
export class RentalModule { }
