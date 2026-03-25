import {
  IsEmail,
  IsString,
  MinLength,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  Matches,
  ValidateIf,
} from 'class-validator';
import { UserRole } from '../schemas/user.schema';
import { RequiresBranchIfManagerOrAccountant } from '../decorators/requires-branch.decorator';
import { RequiresDobIfClient } from '../decorators/requires-dob-if-client.decorator';

export class SignUpDto {
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @IsNotEmpty()
  @IsString()
  lastName: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;


 @ValidateIf(o => o.role === UserRole.CLIENT)
  @IsNotEmpty()
  @IsString()
  city: string;

  @ValidateIf(o => o.role === UserRole.CLIENT)
  @IsNotEmpty()
  @IsString()
  state: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^[0-9+\-\s()]+$/, {
    message: 'Phone number must contain only digits, +, -, spaces, and parentheses',
  })
  phone: string;



  @IsNotEmpty()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsString()
  dateOfBirth?: string;


  // Optional field for branch managers and accountants
  // NEW FIELD: branchId with custom validation
  @IsOptional()
  @IsString()
  @RequiresBranchIfManagerOrAccountant()
  branchId?: string;
}

