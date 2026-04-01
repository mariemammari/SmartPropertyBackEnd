import { IsString, IsNotEmpty } from 'class-validator';

export class UpdateApplicationDto {
  @IsString()
  @IsNotEmpty()
  status: string;
}
