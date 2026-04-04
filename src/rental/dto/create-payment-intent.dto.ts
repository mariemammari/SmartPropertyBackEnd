import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateRentalPaymentIntentDto {
    @IsNumber() @Min(0) @IsOptional() amount?: number;
    @IsString() @IsOptional() currency?: string;
}
