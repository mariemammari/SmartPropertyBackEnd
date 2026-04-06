import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { RentalService } from './rental.service';
import { RentalScheduler } from './rental.scheduler';
import { RentalController } from './rental.controller';
import { RentalDocumentController } from './rental-document.controller';
import { RentalContractService } from './rental-contract.service';
import { RentalDocumentService } from './rental-document.service';
import { Rental, RentalSchema } from './schemas/rental.schema';
import { RentalPayment, RentalPaymentSchema } from './schemas/rental-payment.schema';
import { RentalContract, RentalContractSchema } from './schemas/rental-contract.schema';
import { RentalDocument, RentalDocumentSchema } from './schemas/rental-document.schema';
import { Property, PropertySchema } from '../property/schemas/property.schema';
import { PropertyListing, PropertyListingSchema } from '../property-listing/schemas/property-listing.schema';
import { Application, ApplicationSchema } from '../application/schemas/application.schema';
import { User, UserSchema } from '../user/schemas/user.schema';
import { MailModule } from '../mail/mail.module';
import { FinanceModule } from '../finance/finance.module';

@Module({
    imports: [
        ConfigModule,
        MailModule,
        FinanceModule,
        MongooseModule.forFeature([
            { name: Rental.name, schema: RentalSchema },
            { name: RentalPayment.name, schema: RentalPaymentSchema },
            { name: RentalContract.name, schema: RentalContractSchema },
            { name: RentalDocument.name, schema: RentalDocumentSchema },
            { name: Property.name, schema: PropertySchema },
            { name: PropertyListing.name, schema: PropertyListingSchema },
            { name: Application.name, schema: ApplicationSchema },
            { name: User.name, schema: UserSchema },
        ]),
    ],
    controllers: [RentalController, RentalDocumentController],
    providers: [RentalService, RentalScheduler, RentalContractService, RentalDocumentService],
    exports: [RentalService, RentalContractService, RentalDocumentService],
})
export class RentalModule { }
