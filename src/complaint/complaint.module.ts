import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ComplaintController } from './controllers/complaint.controller';
import { ComplaintService } from './services/complaint.service';
import { Complaint, ComplaintSchema } from './schemas/complaint.schema';
import { BranchModule } from '../branch/branch.module';
import { User, UserSchema } from '../user/schemas/user.schema'; // Import User

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Complaint.name, schema: ComplaintSchema },
      { name: User.name, schema: UserSchema }, // <-- ADD THIS
    ]),
    BranchModule, // This gives you BranchModel
  ],
  controllers: [ComplaintController],
  providers: [ComplaintService],
  exports: [ComplaintService],
})
export class ComplaintModule {}
