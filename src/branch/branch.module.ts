import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Branch, BranchSchema } from './schemas/branch.schema';
import { BranchService } from './branch.service';
import { BranchController } from './branch.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Branch.name, schema: BranchSchema }]),
  ],
  controllers: [BranchController],
  providers: [BranchService],
  exports: [
    MongooseModule, // <-- ADD THIS: exports BranchModel to other modules
    BranchService, // optional: if other modules need BranchService too
  ],
})
export class BranchModule {}
