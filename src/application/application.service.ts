import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Application,
  ApplicationDocument,
  ApplicationStatus,
  RejectionType,
} from './schemas/application.schema';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class ApplicationService {
  constructor(
    @InjectModel(Application.name) private applicationModel: Model<ApplicationDocument>,
  ) { }

  async create(createDto: CreateApplicationDto): Promise<Application> {
    const blockedReapplication = await this.applicationModel.findOne({
      propertyId: createDto.propertyId,
      clientId: createDto.clientId,
      status: ApplicationStatus.REJECTED,
      rejectionType: RejectionType.BLOCKED,
    });

    if (blockedReapplication) {
      throw new BadRequestException(
        'You cannot reapply for this property. Your previous application was rejected as final.',
      );
    }

    const created = new this.applicationModel(createDto);
    return created.save();
  }

  async uploadDocument(file: Express.Multer.File): Promise<string> {
    if (!file) throw new BadRequestException('No file provided');

    return new Promise((resolve, reject) => {
      const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');

      cloudinary.uploader
        .upload_stream(
          {
            resource_type: 'raw',
            folder: 'applications',
            public_id: `app_${Date.now()}_${sanitizedName}`,
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result?.secure_url || '');
          },
        )
        .end(file.buffer);
    });
  }

  async findAllByAgent(agentId: string): Promise<Application[]> {
    return this.applicationModel
      .find({
        $or: [{ agentId: new Types.ObjectId(agentId) }, { agentId: agentId as any }],
      })
      .populate('propertyId', 'title propertyType propertySubType price type city state size address location image images')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findAllByClient(clientId: string): Promise<Application[]> {
    return this.applicationModel
      .find({
        $or: [{ clientId: new Types.ObjectId(clientId) }, { clientId: clientId as any }],
      })
      .populate('propertyId', 'title propertyType propertySubType price type city state size address location image images')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findLatestByClientAndProperty(clientId: string, propertyId: string): Promise<Application | null> {
    return this.applicationModel
      .findOne({
        propertyId,
        $or: [{ clientId: new Types.ObjectId(clientId) }, { clientId: clientId as any }],
      })
      .populate('propertyId', 'title propertyType propertySubType price type city state size address location image images')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findById(id: string): Promise<Application> {
    const application = await this.applicationModel
      .findById(id)
      .populate('propertyId', 'title propertyType propertySubType price type city state size address location image images')
      .exec();

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    return application;
  }

  async updateStatus(id: string, updateDto: UpdateApplicationDto): Promise<Application> {
    const normalizedChecklist = Array.isArray(updateDto.improveChecklist)
      ? Array.from(new Set(updateDto.improveChecklist.map((item) => String(item || '').trim()).filter(Boolean)))
      : [];

    const updatePayload: Record<string, any> = {
      status: updateDto.status,
    };

    if (updateDto.status === ApplicationStatus.REJECTED) {
      updatePayload.rejectionType = updateDto.rejectionType || RejectionType.CAN_REAPPLY;
      updatePayload.rejectionReason = updateDto.rejectionReason?.trim() || undefined;
      updatePayload.improveChecklist = normalizedChecklist;
    } else if (updateDto.status === ApplicationStatus.REQUEST_MORE_DOCUMENTS) {
      updatePayload.rejectionType = undefined;
      updatePayload.rejectionReason = updateDto.rejectionReason?.trim() || undefined;
      updatePayload.improveChecklist = normalizedChecklist;
    } else {
      updatePayload.rejectionType = undefined;
      updatePayload.rejectionReason = undefined;
      updatePayload.improveChecklist = [];
    }

    const updated = await this.applicationModel.findByIdAndUpdate(
      id,
      { $set: updatePayload },
      { new: true },
    );

    if (!updated) throw new NotFoundException('Application not found');
    return updated;
  }
  async findAllByProperty(propertyId: string): Promise<Application[]> {
    return this.applicationModel
      .find({ propertyId })
      .populate('clientId', 'name email')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findAllByBranch(branchId: string): Promise<Application[]> {
    return this.applicationModel
      .find({})
      .populate({
        path: 'propertyId',
        match: { branchId },
        select: 'title propertyType propertySubType price type city state size address location image images branchId',
      })
      .populate('clientId', 'name email phone')
      .populate('agentId', 'name email phone')
      .then((apps) =>
        // Filter out applications whose properties don't match the branchId
        apps.filter((app) => app.propertyId !== null)
      )
      .then((filteredApps) =>
        // Sort by creation date
        filteredApps.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      );
  }
}
