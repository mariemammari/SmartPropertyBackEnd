import { IsOptional, IsNumber } from 'class-validator';

export class CreatePropertyDto {
  title: string;
  description?: string;
  type: 'rent' | 'sale';
  price: number;
  size?: number;
  rooms?: number;
  bathrooms?: number;
  address?: string;
  agent_id?: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;
}
