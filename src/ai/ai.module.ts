import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { PropertyModule } from '../property/PropertyModule';
import { BranchModule } from '../branch/branch.module';

@Module({
  imports: [PropertyModule, BranchModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
