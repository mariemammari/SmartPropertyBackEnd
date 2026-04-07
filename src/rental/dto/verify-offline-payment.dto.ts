import { IsBoolean, IsMongoId, IsOptional, IsString } from 'class-validator';

export class VerifyOfflinePaymentDto {
    @IsMongoId() @IsOptional()
    accountantId?: string;

    @IsBoolean()
    approved!: boolean;

    @IsString() @IsOptional()
    paymentMethodNote?: string;

    @IsMongoId() @IsOptional()
    rentalContractId?: string;
}
