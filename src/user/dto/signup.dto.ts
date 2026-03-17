import {
  IsEmail,
  IsString,
  MinLength,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  Matches,
} from 'class-validator';
import { UserRole } from '../schemas/user.schema';

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

  @IsNotEmpty()
  @IsString()
  @Matches(/^[0-9+\-\s()]+$/, {
    message: 'Phone number must contain only digits, +, -, spaces, and parentheses',
  })
  phone: string;

  @IsNotEmpty()
  @IsString()
  state: string;

  @IsNotEmpty()
  @IsString()
  city: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsNotEmpty()
  @IsString()
  dateOfBirth: string;
}

