import { IsString, IsOptional, IsDate, IsUrl, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export enum ContractSignerRole {
    TENANT = 'tenant',
    OWNER = 'owner',
    AGENT = 'agent',
}

export class CreateRentalContractDto {
    @IsString()
    rentalId!: string;

    // Frontend will upload to Cloudinary, then send URL here
    @IsString()
    documentUrl!: string;

    @IsString()
    @IsOptional()
    publicId?: string;  // From Cloudinary

    @IsString()
    @IsOptional()
    fileName?: string;

    @IsString()
    @IsOptional()
    notes?: string;
}

export class UploadRentalContractDto {
    @IsString()
    rentalId!: string;

    // File uploaded as multipart/form-data
    // Backend will handle Cloudinary upload
}

export class SignRentalContractDto {
    @IsEnum(ContractSignerRole)
    signerRole!: ContractSignerRole;

    @IsDate()
    @Type(() => Date)
    signedAt?: Date;

    @IsUrl()
    @IsOptional()
    signatureImageUrl?: string;

    @IsString()
    @IsOptional()
    signatureImagePublicId?: string;

    @IsString()
    @IsOptional()
    notes?: string;
}
