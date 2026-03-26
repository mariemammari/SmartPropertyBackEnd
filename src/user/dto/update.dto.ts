import { IsString, IsEmail, IsOptional, IsEnum, IsDateString, IsDate } from 'class-validator';
import { UserRole, UserStatus } from '../schemas/user.schema';
import { RequiresBranchIfManagerOrAccountant } from '../decorators/requires-branch.decorator';
// import { RequiresDobIfClient } from '../decorators/requires-dob-if-client.decorator';
import { Type } from 'class-transformer';

export class UpdateUserDto {
    @IsOptional()
    @IsString()
    fullName?: string;

    @IsOptional()
    @IsEmail()
    email?: string;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsOptional()
    @IsString()
    password?: string;

    @IsOptional()
    @IsString()
    city?: string;

    @IsOptional()
    @IsString()
    photo?: string;

    @IsOptional()
    @IsEnum(UserRole)
    role?: UserRole;

    @IsOptional()
    @IsString()
    @RequiresBranchIfManagerOrAccountant()
    branchId?: string;

    @IsOptional()
    @IsEnum(UserStatus)
    status?: UserStatus;

    @IsOptional()
    @IsString()
    Ai_riskScore?: string;

    @IsOptional()
    @IsString({ each: true })
    documents?: string[];

    @IsOptional()
    @IsString({ each: true })
    managedProperties?: string[];

    @IsOptional()
    @IsString({ each: true })
    savedProperties?: string[];

    @IsOptional()
    @IsString()
    // @RequiresDobIfClient()
    dateOfBirth?: string;


    //mariem
    @IsOptional()
    @IsString()
    resetPasswordToken?: string;

    @IsOptional()
    @IsDate()
    @Type(() => Date)
    resetPasswordExpires?: Date; // ← Changed from string to Date


    @IsOptional()
    @IsString()
    signature?: string;

}