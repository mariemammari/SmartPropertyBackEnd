import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Visit, VisitDocument, VisitStatus } from './schema/visit.schema';
import { CreateVisitDto, UpdateVisitDto } from './dto/visit.dto';

@Injectable()
export class VisitsService {
  constructor(
    @InjectModel(Visit.name) private visitModel: Model<VisitDocument>,
  ) {}

  async create(dto: CreateVisitDto): Promise<Visit> {
    const visit = new this.visitModel({
      ...dto,
      propertyId: new Types.ObjectId(dto.propertyId),
      agentId: dto.agentId ? new Types.ObjectId(dto.agentId) : undefined,
      requestedSlots: dto.requestedSlots?.map(s => new Date(s)) ?? [],
      confirmedSlot: dto.confirmedSlot ? new Date(dto.confirmedSlot) : undefined,
    });
    return visit.save();
  }

  async findAll(): Promise<Visit[]> {
    return this.visitModel
      .find()
      .populate('propertyId', 'title address images')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(id: string): Promise<Visit> {
    const visit = await this.visitModel
      .findById(id)
      .populate('propertyId', 'title address images')
      .exec();
    if (!visit) throw new NotFoundException(`Visit ${id} not found`);
    return visit;
  }

  async findByProperty(propertyId: string): Promise<Visit[]> {
    return this.visitModel
      .find({ propertyId: new Types.ObjectId(propertyId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findByStatus(status: VisitStatus): Promise<Visit[]> {
    return this.visitModel
      .find({ status })
      .populate('propertyId', 'title address')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findUrgent(): Promise<Visit[]> {
    // Returns REQUESTED + PROPOSED visits older than 12h
    const threshold = new Date(Date.now() - 12 * 60 * 60 * 1000);
    return this.visitModel
      .find({
        status: { $in: [VisitStatus.REQUESTED, VisitStatus.PROPOSED] },
        createdAt: { $lte: threshold },
      })
      .populate('propertyId', 'title address')
      .sort({ createdAt: 1 }) // oldest first = most urgent
      .exec();
  }

  async findToday(): Promise<Visit[]> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    return this.visitModel
      .find({
        confirmedSlot: { $gte: start, $lte: end },
        status: VisitStatus.CONFIRMED,
      })
      .populate('propertyId', 'title address')
      .sort({ confirmedSlot: 1 })
      .exec();
  }

  async update(id: string, dto: UpdateVisitDto): Promise<Visit> {
    const update: any = { ...dto };
    if (dto.requestedSlots) update.requestedSlots = dto.requestedSlots.map(s => new Date(s));
    if (dto.confirmedSlot)  update.confirmedSlot  = new Date(dto.confirmedSlot);

    const visit = await this.visitModel
      .findByIdAndUpdate(id, update, { new: true })
      .exec();
    if (!visit) throw new NotFoundException(`Visit ${id} not found`);
    return visit;
  }

  async remove(id: string): Promise<void> {
    const result = await this.visitModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException(`Visit ${id} not found`);
  }

  async getStats(): Promise<any> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const next7Days    = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const todayStart   = new Date(); todayStart.setHours(0,0,0,0);
    const todayEnd     = new Date(); todayEnd.setHours(23,59,59,999);

    const [pending, confirmed7, today, completedMonth, noShow] = await Promise.all([
      this.visitModel.countDocuments({ status: { $in: [VisitStatus.REQUESTED, VisitStatus.PROPOSED] } }),
      this.visitModel.countDocuments({ status: VisitStatus.CONFIRMED, confirmedSlot: { $lte: next7Days } }),
      this.visitModel.countDocuments({ status: VisitStatus.CONFIRMED, confirmedSlot: { $gte: todayStart, $lte: todayEnd } }),
      this.visitModel.countDocuments({ status: VisitStatus.COMPLETED, updatedAt: { $gte: startOfMonth } }),
      this.visitModel.countDocuments({ status: VisitStatus.NO_SHOW,   updatedAt: { $gte: startOfMonth } }),
    ]);

    const totalClosed   = completedMonth + noShow;
    const noShowRate    = totalClosed > 0 ? Math.round((noShow / totalClosed) * 100) : 0;
    const conversionRate = totalClosed > 0 ? Math.round((completedMonth / totalClosed) * 100) : 0;

    return { pending, confirmed7, today, completedMonth, noShowRate, conversionRate };
  }
}