import {
  IsString,
  IsEmail,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  Matches,
} from 'class-validator';

export enum BranchStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export class CreateBranchDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  phone_number: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsEnum(BranchStatus)
  @IsOptional()
  status?: BranchStatus = BranchStatus.ACTIVE;

  @IsString()
  @IsNotEmpty()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'opening_time must be in HH:MM format (e.g., 09:00)',
  })
  opening_time: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'closing_time must be in HH:MM format (e.g., 18:00)',
  })
  closing_time: string;
}
