import {
  IsDate,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RentalPaymentMethod } from '../schemas/rental-payment.schema';

export class CreateOfflinePaymentDto {
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsEnum(RentalPaymentMethod)
  paymentMethod!: RentalPaymentMethod.CASH | RentalPaymentMethod.CHEQUE;

  @IsString()
  @IsOptional()
  paymentMethodNote?: string;

  @IsString()
  @IsOptional()
  paymentProofUrl?: string;

  @IsString()
  @IsOptional()
  chequeNumber?: string;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  chequeDate?: Date;

  @IsString()
  @IsOptional()
  bankName?: string;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  billingPeriodStart?: Date;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  billingPeriodEnd?: Date;

  @IsMongoId()
  @IsOptional()
  rentalContractId?: string;
}
