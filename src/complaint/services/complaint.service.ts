import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Complaint,
  ComplaintDocument,
  ComplaintStatus,
  ComplaintTarget,
} from '../schemas/complaint.schema';
import {
  CreateComplaintDto,
  UpdateComplaintDto,
  AdminResponseDto,
  ResolveComplaintDto,
  ClientFeedbackDto,
} from '../dto/complaint.dto';

@Injectable()
export class ComplaintService {
  constructor(
    @InjectModel(Complaint.name)
    private complaintModel: Model<ComplaintDocument>,
    @InjectModel('Branch') private branchModel: Model<any>, // Inject Branch model
    @InjectModel('User') private userModel: Model<any>, // Inject User model
  ) {}

  // ─── Create ─────────────────────────────────────────────────────────────
  async create(dto: CreateComplaintDto, userId: string): Promise<Complaint> {
    // Validate branch exists if provided
    if (dto.branchId) {
      const branch = await this.branchModel.findById(dto.branchId);
      if (!branch) {
        throw new BadRequestException('Selected branch does not exist');
      }
    }

    const complaint = new this.complaintModel({
      ...dto,
      userId: new Types.ObjectId(userId),
      branchId: dto.branchId ? new Types.ObjectId(dto.branchId) : undefined,
      propertyId: dto.propertyId
        ? new Types.ObjectId(dto.propertyId)
        : undefined,
      status: ComplaintStatus.OPEN,
    });

    return complaint.save();
  }

  // ─── Find All (Admin sees all, Branch Manager sees branch only) ─────────
  async findAll(options: {
    status?: ComplaintStatus;
    target?: string;
    priority?: string;
    branchId?: string;
    page: number;
    limit: number;
  }) {
    const { status, target, priority, branchId, page, limit } = options;

    const query: any = {};

    if (status) query.status = status;
    if (target) query.target = target;
    if (priority) query.priority = priority;

    // If branchId provided (for branch manager), filter by branch
    if (branchId) {
      query.branchId = new Types.ObjectId(branchId);
    }

    const skip = (page - 1) * limit;

    const [complaints, total] = await Promise.all([
      this.complaintModel
        .find(query)
        .populate('userId', 'name email')
        .populate('branchId', 'name city') // NEW: Populate branch
        .populate('assignedTo', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.complaintModel.countDocuments(query),
    ]);

    return {
      complaints,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // ─── Find by Client ─────────────────────────────────────────────────────
  async findByClient(
    userId: string,
    options: {
      status?: ComplaintStatus;
      page: number;
      limit: number;
    },
  ) {
    const { status, page, limit } = options;

    const query: any = { userId: new Types.ObjectId(userId) };
    if (status) query.status = status;

    const skip = (page - 1) * limit;

    const [complaints, total] = await Promise.all([
      this.complaintModel
        .find(query)
        .populate('branchId', 'name city') // NEW: Populate branch
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.complaintModel.countDocuments(query),
    ]);

    return {
      complaints,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // ─── Find by ID ─────────────────────────────────────────────────────────
  async findById(id: string): Promise<ComplaintDocument> {
    const complaint = await this.complaintModel
      .findById(id)
      .populate('userId', 'name email phone')
      .populate('branchId', 'name city managerId') // NEW: Populate branch with manager
      .populate('propertyId', 'title address')
      .populate('assignedTo', 'name email')
      .exec();

    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }

    return complaint;
  }

  // ─── Update ─────────────────────────────────────────────────────────────
  async update(
    id: string,
    dto: UpdateComplaintDto,
    userId: string,
  ): Promise<Complaint> {
    const complaint = await this.findById(id);

    // Only client who created can update, and only if still OPEN
    if (complaint.userId.toString() !== userId) {
      throw new ForbiddenException('You can only update your own complaints');
    }

    if (complaint.status !== ComplaintStatus.OPEN) {
      throw new ForbiddenException(
        'Cannot update complaint after it has been processed',
      );
    }

    Object.assign(complaint, dto);
    return complaint.save();
  }

  // ─── Add Admin Response ─────────────────────────────────────────────────
  async addAdminResponse(
    id: string,
    dto: AdminResponseDto,
    adminId: string,
  ): Promise<Complaint> {
    const complaint = await this.findById(id);

    complaint.adminNote = dto.adminNote;

    if (dto.assignedTo) {
      complaint.assignedTo = new Types.ObjectId(dto.assignedTo);
    } else {
      complaint.assignedTo = new Types.ObjectId(adminId);
    }

    if (dto.status) {
      complaint.status = dto.status;
    }

    return complaint.save();
  }

  // ─── Resolve ──────────────────────────────────────────────────────────────
  async resolve(id: string, dto: ResolveComplaintDto): Promise<Complaint> {
    const complaint = await this.findById(id);

    complaint.status = dto.status || ComplaintStatus.RESOLVED;
    complaint.resolvedAt = new Date();
    complaint.adminNote = dto.adminNote;

    return complaint.save();
  }

  // ─── Add Client Feedback ────────────────────────────────────────────────
  async addClientFeedback(
    id: string,
    dto: ClientFeedbackDto,
    userId: string,
  ): Promise<Complaint> {
    const complaint = await this.findById(id);

    if (complaint.userId.toString() !== userId) {
      throw new ForbiddenException(
        'You can only feedback on your own complaints',
      );
    }

    complaint.rating = dto.rating;
    complaint.clientFeedback = dto.feedback;

    return complaint.save();
  }

  // ─── Mark as Read ─────────────────────────────────────────────────────────
  async markAsRead(id: string, userId: string): Promise<Complaint> {
    const complaint = await this.findById(id);

    if (complaint.userId.toString() !== userId) {
      throw new ForbiddenException('Access denied');
    }

    complaint.isRead = true;
    return complaint.save();
  }

  // ─── Delete ─────────────────────────────────────────────────────────────────
  async delete(id: string, userId: string): Promise<void> {
    const complaint = await this.findById(id);

    // Only allow delete if client owns it and it's still OPEN
    if (complaint.userId.toString() !== userId) {
      throw new ForbiddenException('You can only delete your own complaints');
    }

    if (complaint.status !== ComplaintStatus.OPEN) {
      throw new ForbiddenException(
        'Cannot delete complaint after it has been processed',
      );
    }

    await this.complaintModel.findByIdAndDelete(id);
  }

  // ─── Statistics ───────────────────────────────────────────────────────────
  async getStatistics(branchId?: string): Promise<any> {
    const matchStage: any = {};
    if (branchId) {
      matchStage.branchId = new Types.ObjectId(branchId);
    }

    const statusCounts = await this.complaintModel.aggregate([
      { $match: matchStage },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const targetCounts = await this.complaintModel.aggregate([
      { $match: matchStage },
      { $group: { _id: '$target', count: { $sum: 1 } } },
    ]);

    return {
      total: await this.complaintModel.countDocuments(matchStage),
      byStatus: statusCounts.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {}),
      byTarget: targetCounts.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {}),
    };
  }
}
