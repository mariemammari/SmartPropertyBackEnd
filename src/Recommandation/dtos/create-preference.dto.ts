import { IsString, IsNumber, IsNotEmpty } from 'class-validator';

export class CreatePreferenceDto {
  @IsNumber()
  @IsNotEmpty()
  budgetMin: number;

  @IsNumber()
  @IsNotEmpty()
  budgetMax: number;

  @IsString()
  @IsNotEmpty()
  preferredPropertyType: string;

  @IsString()
  @IsNotEmpty()
  preferredCity: string;

  @IsNumber()
  @IsNotEmpty()
  monthlyIncome: number;
}
