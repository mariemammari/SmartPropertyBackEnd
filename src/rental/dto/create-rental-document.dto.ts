import { IsString, IsOptional, IsBoolean, IsDate, IsEnum, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { RentalDocumentType } from '../schemas/rental-document.schema';

export class CreateRentalDocumentDto {
    @IsString()
    rentalId!: string;

    @IsEnum(RentalDocumentType)
    documentType!: RentalDocumentType;

    @IsString()
    title!: string;

    @IsString()
    @IsOptional()
    description?: string;

    // Frontend uploads to Cloudinary, sends URL
    @IsString()
    documentUrl!: string;

    @IsString()
    @IsOptional()
    publicId?: string;  // Cloudinary ID

    @IsString()
    @IsOptional()
    fileName?: string;

    @IsBoolean()
    @IsOptional()
    isPublic?: boolean;

    @IsArray()
    @IsOptional()
    visibleToUserIds?: string[];

    @IsDate()
    @Type(() => Date)
    @IsOptional()
    expiresAt?: Date;

    @IsString()
    @IsOptional()
    notes?: string;
}

export class UpdateRentalDocumentDto {
    @IsString()
    @IsOptional()
    title?: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsBoolean()
    @IsOptional()
    isPublic?: boolean;

    @IsArray()
    @IsOptional()
    visibleToUserIds?: string[];

    @IsDate()
    @Type(() => Date)
    @IsOptional()
    expiresAt?: Date;

    @IsString()
    @IsOptional()
    notes?: string;
}
