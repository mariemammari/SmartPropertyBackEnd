import { IsBoolean, IsOptional } from 'class-validator';

export class RunSolvencyAnalysisDto {
  @IsBoolean()
  @IsOptional()
  force?: boolean;
}
