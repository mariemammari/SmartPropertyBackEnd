export { ComplaintModule } from './complaint.module';
export { ComplaintService } from './services/complaint.service';
export { ComplaintController } from './controllers/complaint.controller';
export { Complaint, ComplaintSchema, ComplaintTarget, ComplaintStatus, ComplaintPriority } from './schemas/complaint.schema';
export {
    CreateComplaintDto,
    UpdateComplaintDto,
    AdminResponseDto,
    ResolveComplaintDto,
    ClientFeedbackDto
} from './dto/complaint.dto';
