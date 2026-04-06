import { IsNumber, IsOptional, IsString, Min, IsDate, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRentalPaymentIntentDto {
    @IsNumber() @Min(0) @IsOptional() amount?: number;
    @IsString() @IsOptional() currency?: string;

    // ─── BILLING PERIOD FIELDS ───────────────────────────────────────
    @Type(() => Date) @IsDate() @IsOptional() billingPeriodStart?: Date;
    @Type(() => Date) @IsDate() @IsOptional() billingPeriodEnd?: Date;

    @IsNumber() @IsOptional() trancheNumber?: number;     // For multi-tranche: 1, 2, 3
    @IsBoolean() @IsOptional() isMultiMonth?: boolean;    // For 5+ month upfront
}
