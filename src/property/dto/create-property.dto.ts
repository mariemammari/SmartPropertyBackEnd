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
}
