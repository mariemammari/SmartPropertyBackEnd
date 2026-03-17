import { IsEmail, IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class SignInDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  password: string;

  @IsOptional()
  rememberMe?: boolean;
}

