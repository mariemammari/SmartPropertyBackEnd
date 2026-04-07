import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';
import { Invoice, InvoiceSchema } from './schemas/invoice.schema';
import { User, UserSchema } from '../user/schemas/user.schema';
import { RentalPayment, RentalPaymentSchema } from '../rental/schemas/rental-payment.schema';
import { Rental, RentalSchema } from '../rental/schemas/rental.schema';
import { Property, PropertySchema } from '../property/schemas/property.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Invoice.name, schema: InvoiceSchema }]),
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    MongooseModule.forFeature([{ name: RentalPayment.name, schema: RentalPaymentSchema }]),
    MongooseModule.forFeature([{ name: Rental.name, schema: RentalSchema }]),
    MongooseModule.forFeature([{ name: Property.name, schema: PropertySchema }]),
  ],
  controllers: [FinanceController],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}
