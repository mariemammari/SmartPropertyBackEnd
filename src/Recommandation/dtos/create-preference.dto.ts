import { IsString, IsNumber, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class CreatePreferenceDto {
  @IsNumber()
  @IsNotEmpty()
  budgetMin!: number;

  @IsNumber()
  @IsNotEmpty()
  budgetMax!: number;

  @IsString()
  @IsNotEmpty()
  preferredPropertyType!: string;

  @IsString()
  @IsNotEmpty()
  preferredCity!: string;

  @IsString()
  @IsOptional()
  @IsIn(['rent', 'sale'])
  preferredPurpose?: string;

  @IsNumber()
  @IsNotEmpty()
  monthlyIncome!: number;
}
