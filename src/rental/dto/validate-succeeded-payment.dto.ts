import { IsBoolean, IsMongoId, IsOptional, IsString } from 'class-validator';

export class ValidateSucceededPaymentDto {
    @IsBoolean()
    approved!: boolean;

    @IsString()
    @IsOptional()
    paymentMethodNote?: string;

    @IsMongoId()
    @IsOptional()
    rentalContractId?: string;

    @IsBoolean()
    @IsOptional()
    resendNotification?: boolean;
}
