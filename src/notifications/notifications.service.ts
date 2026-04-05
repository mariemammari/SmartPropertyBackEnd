import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationType } from './schemas/notification.schema';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name) private notificationModel: Model<Notification>,
  ) {}

  async create(createNotificationDto: CreateNotificationDto): Promise<Notification> {
    const createdNotification = new this.notificationModel(createNotificationDto);
    return createdNotification.save();
  }

  async createMilestoneIfMissing(params: {
    recipientId: string;
    propertyId: string;
    title: string;
    message: string;
  }): Promise<Notification | null> {
    const { recipientId, propertyId, title, message } = params;

    if (!Types.ObjectId.isValid(recipientId) || !Types.ObjectId.isValid(propertyId)) {
      return null;
    }

    const recipientObjectId = new Types.ObjectId(recipientId);
    const propertyObjectId = new Types.ObjectId(propertyId);

    const exists = await this.notificationModel.findOne({
      recipientId: recipientObjectId,
      propertyId: propertyObjectId,
      type: NotificationType.MILESTONE,
      title,
    }).select('_id').lean();

    if (exists) {
      return null;
    }

    const createdNotification = new this.notificationModel({
      recipientId: recipientObjectId,
      propertyId: propertyObjectId,
      type: NotificationType.MILESTONE,
      title,
      message,
    });

    return createdNotification.save();
  }

  async findByUserId(userId: string): Promise<Notification[]> {
    // Try both ObjectId strictly and a string fallback in case of datatype mismatch in DB
    return this.notificationModel.find({
      $or: [
        { recipientId: new Types.ObjectId(userId) },
        { recipientId: userId as any }
      ]
    }).sort({ createdAt: -1 }).exec();
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationModel.countDocuments({
      $or: [
        { recipientId: new Types.ObjectId(userId) },
        { recipientId: userId as any }
      ],
      isRead: false
    }).exec();
  }

  async markAsRead(notificationId: string): Promise<Notification | null> {
    return this.notificationModel.findByIdAndUpdate(
      notificationId,
      { isRead: true },
      { new: true }
    ).exec();
  }

  async markAllAsRead(userId: string): Promise<any> {
    return this.notificationModel.updateMany(
      { 
        $or: [
          { recipientId: new Types.ObjectId(userId) },
          { recipientId: userId as any }
        ],
        isRead: false 
      },
      { $set: { isRead: true } }
    ).exec();
  }
}
