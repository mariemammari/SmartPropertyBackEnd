import { IsString, IsEmail, IsOptional, IsEnum, Matches } from 'class-validator';
import { BranchStatus } from './create-branch.dto';

export class UpdateBranchDto {
    @IsString()
    @IsOptional()
    name?: string;

    @IsString()
    @IsOptional()
    address?: string;

    @IsString()
    @IsOptional()
    city?: string;

    @IsString()
    @IsOptional()
    phone_number?: string;

    @IsEmail()
    @IsOptional()
    email?: string;

    @IsEnum(BranchStatus)
    @IsOptional()
    status?: BranchStatus;

    @IsString()
    @IsOptional()
    @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
        message: 'opening_time must be in HH:MM format (e.g., 09:00)',
    })
    opening_time?: string;

    @IsString()
    @IsOptional()
    @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
        message: 'closing_time must be in HH:MM format (e.g., 18:00)',
    })
    closing_time?: string;
}