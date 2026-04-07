import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Property,
  PropertyDocument,
} from '../property/schemas/property.schema';
import { User, UserDocument, UserRole } from '../user/schemas/user.schema';
import { NotificationsService } from '../notifications/notifications.service';
import {
  PropertyEngagementEvent,
  PropertyEngagementEventDocument,
  PropertyEngagementEventType,
} from './schemas/property-engagement-event.schema';

type EngagementScope = 'agent' | 'branch' | 'global';

@Injectable()
export class PropertyEngagementService {
  constructor(
    @InjectModel(PropertyEngagementEvent.name)
    private readonly eventModel: Model<PropertyEngagementEventDocument>,
    @InjectModel(Property.name)
    private readonly propertyModel: Model<PropertyDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly notificationsService: NotificationsService,
  ) {}

  private toSafeText(value: any): string {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  private normalizePropertyTitle(property: any): string {
    if (!property) return 'Property';

    if (this.toSafeText(property.title)) {
      return this.toSafeText(property.title);
    }

    const type = this.toSafeText(property.propertyType);
    const city = this.toSafeText(property.city);
    const address = this.toSafeText(property.address);

    if (type && city) {
      return `${type} - ${city}`;
    }

    if (type) {
      return type;
    }

    if (address) {
      return address;
    }

    return 'Property';
  }

  private resolveUserId(currentUser: any): string {
    const userId = currentUser?.userId || currentUser?.id || currentUser?.sub;
    if (!userId) {
      throw new BadRequestException('Missing authenticated user context');
    }
    return String(userId);
  }

  private buildScopeMatch(
    scope: EngagementScope,
    currentUser: any,
  ): Record<string, any> {
    const role = currentUser?.role;
    const userId = this.resolveUserId(currentUser);

    if (scope === 'agent') {
      if (role !== UserRole.REAL_ESTATE_AGENT) {
        throw new ForbiddenException(
          'Agent summary is available to real estate agents only',
        );
      }
      return { propertyCreatedById: userId };
    }

    if (scope === 'branch') {
      if (role !== UserRole.BRANCH_MANAGER) {
        throw new ForbiddenException(
          'Branch summary is available to branch managers only',
        );
      }

      const branchId = this.toSafeText(currentUser?.branchId);
      if (!branchId) {
        throw new ForbiddenException(
          'Branch manager does not have a branch assigned',
        );
      }

      return { propertyBranchId: branchId };
    }

    if (scope === 'global') {
      if (role !== UserRole.SUPER_ADMIN) {
        throw new ForbiddenException(
          'Global summary is available to super admins only',
        );
      }
      return {};
    }

    return {};
  }

  private assertCanAccessProperty(property: any, currentUser: any): void {
    const role = currentUser?.role;
    const userId = this.resolveUserId(currentUser);

    if (role === UserRole.SUPER_ADMIN) {
      return;
    }

    if (role === UserRole.REAL_ESTATE_AGENT) {
      const createdBy = this.toSafeText(property?.createdBy);
      if (!createdBy || createdBy !== userId) {
        throw new ForbiddenException(
          'You can access engagement stats for your own properties only',
        );
      }
      return;
    }

    if (role === UserRole.BRANCH_MANAGER) {
      const branchId = this.toSafeText(currentUser?.branchId);
      const propertyBranch = this.toSafeText(property?.branchId);
      if (!branchId || !propertyBranch || propertyBranch !== branchId) {
        throw new ForbiddenException(
          'You can access engagement stats for your branch properties only',
        );
      }
      return;
    }

    if (role === UserRole.CLIENT) {
      return;
    }

    throw new ForbiddenException(
      'You are not allowed to access property engagement statistics',
    );
  }

  private async notifyMilestoneIfNeeded(params: {
    propertyId: string;
    propertyTitle: string;
    createdBy: string;
    branchId: string;
  }): Promise<void> {
    const propertyObjectId = new Types.ObjectId(params.propertyId);

    const [totals] = await this.eventModel.aggregate([
      { $match: { propertyId: propertyObjectId } },
      {
        $group: {
          _id: null,
          clicks: {
            $sum: {
              $cond: [
                { $eq: ['$eventType', PropertyEngagementEventType.CLICK] },
                1,
                0,
              ],
            },
          },
          views: {
            $sum: {
              $cond: [
                { $eq: ['$eventType', PropertyEngagementEventType.VIEW] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const views = Number(totals?.views || 0);
    const milestone = Math.floor(views / 3) * 3;

    if (milestone < 3) {
      return;
    }

    const clicks = Number(totals?.clicks || 0);

    const recipientIds = new Set<string>();
    if (Types.ObjectId.isValid(params.createdBy)) {
      recipientIds.add(params.createdBy);
    }

    if (params.branchId) {
      const branchManagers = await this.userModel
        .find({ role: UserRole.BRANCH_MANAGER, branchId: params.branchId })
        .select('_id')
        .lean();

      branchManagers.forEach((manager: any) => {
        const managerId = this.toSafeText(manager?._id);
        if (Types.ObjectId.isValid(managerId)) {
          recipientIds.add(managerId);
        }
      });
    }

    if (!recipientIds.size) {
      return;
    }

    const title = `Property Milestone: ${milestone} Views`;
    const message = `"${params.propertyTitle}" reached the ${milestone}-view milestone (${views} total views, ${clicks} clicks recorded).`;

    await Promise.all(
      [...recipientIds].map((recipientId) =>
        this.notificationsService.createMilestoneIfMissing({
          recipientId,
          propertyId: params.propertyId,
          title,
          message,
        }),
      ),
    );
  }

  async trackEvent(currentUser: any, payload: any): Promise<any> {
    const userId = this.resolveUserId(currentUser);
    const propertyId = this.toSafeText(payload?.propertyId);
    const eventType = this.toSafeText(payload?.eventType).toUpperCase();

    if (!propertyId || !Types.ObjectId.isValid(propertyId)) {
      throw new BadRequestException('Invalid propertyId');
    }

    if (
      eventType !== PropertyEngagementEventType.CLICK &&
      eventType !== PropertyEngagementEventType.VIEW &&
      eventType !== PropertyEngagementEventType.SAVE
    ) {
      throw new BadRequestException('eventType must be CLICK, VIEW or SAVE');
    }

    const property = await this.propertyModel
      .findById(propertyId)
      .select('_id title propertyType city address createdBy branchId')
      .lean();

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    if (eventType === PropertyEngagementEventType.VIEW) {
      const threshold = new Date(Date.now() - 30 * 60 * 1000);
      const recentView = await this.eventModel
        .findOne({
          propertyId: new Types.ObjectId(propertyId),
          userId,
          eventType: PropertyEngagementEventType.VIEW,
          createdAt: { $gte: threshold },
        })
        .select('_id createdAt')
        .lean();

      if (recentView) {
        return {
          recorded: false,
          deduped: true,
          reason: 'recent_view_exists',
          propertyId,
        };
      }
    }

    const createdBy = this.toSafeText((property as any)?.createdBy);
    const branchId = this.toSafeText((property as any)?.branchId);
    const propertyTitle = this.normalizePropertyTitle(property);

    const event = await this.eventModel.create({
      propertyId: new Types.ObjectId(propertyId),
      userId,
      eventType,
      role: this.toSafeText(currentUser?.role),
      pagePath: this.toSafeText(payload?.pagePath),
      source: this.toSafeText(payload?.source),
      propertyBranchId: branchId,
      propertyCreatedById: createdBy,
      propertyTitleSnapshot: propertyTitle,
    });

    try {
      await this.notifyMilestoneIfNeeded({
        propertyId,
        propertyTitle,
        createdBy,
        branchId,
      });
    } catch {
      // Engagement tracking must not fail if milestone notification creation fails.
    }

    return {
      recorded: true,
      deduped: false,
      eventId: String(event._id),
      propertyId,
      eventType,
    };
  }

  async getSummaryForScope(
    scope: EngagementScope,
    currentUser: any,
  ): Promise<any> {
    const match = this.buildScopeMatch(scope, currentUser);

    const totalsAgg = await this.eventModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          clicks: {
            $sum: {
              $cond: [
                { $eq: ['$eventType', PropertyEngagementEventType.CLICK] },
                1,
                0,
              ],
            },
          },
          views: {
            $sum: {
              $cond: [
                { $eq: ['$eventType', PropertyEngagementEventType.VIEW] },
                1,
                0,
              ],
            },
          },
          saves: {
            $sum: {
              $cond: [
                { $eq: ['$eventType', PropertyEngagementEventType.SAVE] },
                1,
                0,
              ],
            },
          },
          totalEvents: { $sum: 1 },
          uniqueUsersSet: { $addToSet: '$userId' },
          uniquePropertiesSet: { $addToSet: '$propertyId' },
          lastEventAt: { $max: '$createdAt' },
        },
      },
      {
        $project: {
          _id: 0,
          clicks: 1,
          views: 1,
          saves: 1,
          totalEvents: 1,
          uniqueUsers: { $size: '$uniqueUsersSet' },
          uniqueProperties: { $size: '$uniquePropertiesSet' },
          lastEventAt: 1,
        },
      },
    ]);

    const propertiesAgg = await this.eventModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$propertyId',
          clicks: {
            $sum: {
              $cond: [
                { $eq: ['$eventType', PropertyEngagementEventType.CLICK] },
                1,
                0,
              ],
            },
          },
          views: {
            $sum: {
              $cond: [
                { $eq: ['$eventType', PropertyEngagementEventType.VIEW] },
                1,
                0,
              ],
            },
          },
          saves: {
            $sum: {
              $cond: [
                { $eq: ['$eventType', PropertyEngagementEventType.SAVE] },
                1,
                0,
              ],
            },
          },
          totalEvents: { $sum: 1 },
          uniqueUsersSet: { $addToSet: '$userId' },
          lastEventAt: { $max: '$createdAt' },
          propertyTitleSnapshot: { $first: '$propertyTitleSnapshot' },
        },
      },
      {
        $project: {
          _id: 0,
          propertyId: '$_id',
          clicks: 1,
          views: 1,
          saves: 1,
          totalEvents: 1,
          uniqueUsers: { $size: '$uniqueUsersSet' },
          lastEventAt: 1,
          propertyTitleSnapshot: 1,
        },
      },
      { $sort: { views: -1, clicks: -1, lastEventAt: -1 } },
    ]);

    const usersAgg = await this.eventModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$userId',
          clicks: {
            $sum: {
              $cond: [
                { $eq: ['$eventType', PropertyEngagementEventType.CLICK] },
                1,
                0,
              ],
            },
          },
          views: {
            $sum: {
              $cond: [
                { $eq: ['$eventType', PropertyEngagementEventType.VIEW] },
                1,
                0,
              ],
            },
          },
          saves: {
            $sum: {
              $cond: [
                { $eq: ['$eventType', PropertyEngagementEventType.SAVE] },
                1,
                0,
              ],
            },
          },
          totalEvents: { $sum: 1 },
          uniquePropertiesSet: { $addToSet: '$propertyId' },
          lastEventAt: { $max: '$createdAt' },
        },
      },
      {
        $project: {
          _id: 0,
          userId: '$_id',
          clicks: 1,
          views: 1,
          saves: 1,
          totalEvents: 1,
          uniqueProperties: { $size: '$uniquePropertiesSet' },
          lastEventAt: 1,
        },
      },
      { $sort: { views: -1, clicks: -1, lastEventAt: -1 } },
    ]);

    const propertyIds = propertiesAgg
      .map((item: any) => item.propertyId)
      .filter(Boolean);
    const userIds = usersAgg
      .map((item: any) => this.toSafeText(item.userId))
      .filter(Boolean);

    const properties = propertyIds.length
      ? await this.propertyModel
          .find({ _id: { $in: propertyIds } })
          .select('_id title propertyType city address')
          .lean()
      : [];

    const users = userIds.length
      ? await this.userModel
          .find({ _id: { $in: userIds } })
          .select('_id fullName role email')
          .lean()
      : [];

    const propertyMap = new Map(
      properties.map((property: any) => [
        String(property._id),
        this.normalizePropertyTitle(property),
      ]),
    );

    const userMap = new Map(users.map((user: any) => [String(user._id), user]));

    const enrichedProperties = propertiesAgg.map((item: any) => {
      const propertyId = String(item.propertyId);
      return {
        propertyId,
        propertyTitle:
          propertyMap.get(propertyId) ||
          this.toSafeText(item.propertyTitleSnapshot) ||
          `Property #${propertyId.slice(-6)}`,
        clicks: Number(item.clicks) || 0,
        views: Number(item.views) || 0,
        saves: Number(item.saves) || 0,
        totalEvents: Number(item.totalEvents) || 0,
        uniqueUsers: Number(item.uniqueUsers) || 0,
        lastEventAt: item.lastEventAt || null,
      };
    });

    const enrichedUsers = usersAgg.map((item: any) => {
      const userId = this.toSafeText(item.userId);
      const user = userMap.get(userId);
      return {
        userId,
        fullName:
          this.toSafeText(user?.fullName) || `User #${userId.slice(-6)}`,
        role: this.toSafeText(user?.role) || 'unknown',
        email: this.toSafeText(user?.email),
        clicks: Number(item.clicks) || 0,
        views: Number(item.views) || 0,
        saves: Number(item.saves) || 0,
        totalEvents: Number(item.totalEvents) || 0,
        uniqueProperties: Number(item.uniqueProperties) || 0,
        lastEventAt: item.lastEventAt || null,
      };
    });

    const totals =
      totalsAgg[0] ||
      ({
        clicks: 0,
        views: 0,
        saves: 0,
        totalEvents: 0,
        uniqueUsers: 0,
        uniqueProperties: 0,
        lastEventAt: null,
      } as any);

    return {
      scope,
      generatedAt: new Date().toISOString(),
      totals,
      properties: enrichedProperties,
      users: enrichedUsers,
    };
  }

  async getPropertySummary(propertyId: string, currentUser: any): Promise<any> {
    if (!propertyId || !Types.ObjectId.isValid(propertyId)) {
      throw new BadRequestException('Invalid propertyId');
    }

    const property = await this.propertyModel
      .findById(propertyId)
      .select('_id title propertyType city address createdBy branchId')
      .lean();

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    this.assertCanAccessProperty(property, currentUser);

    const match: Record<string, any> = {
      propertyId: new Types.ObjectId(propertyId),
    };

    if (currentUser?.role === UserRole.REAL_ESTATE_AGENT) {
      match.propertyCreatedById = this.resolveUserId(currentUser);
    }

    if (currentUser?.role === UserRole.BRANCH_MANAGER) {
      match.propertyBranchId = this.toSafeText(currentUser?.branchId);
    }

    const totalsAgg = await this.eventModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          clicks: {
            $sum: {
              $cond: [
                { $eq: ['$eventType', PropertyEngagementEventType.CLICK] },
                1,
                0,
              ],
            },
          },
          views: {
            $sum: {
              $cond: [
                { $eq: ['$eventType', PropertyEngagementEventType.VIEW] },
                1,
                0,
              ],
            },
          },
          saves: {
            $sum: {
              $cond: [
                { $eq: ['$eventType', PropertyEngagementEventType.SAVE] },
                1,
                0,
              ],
            },
          },
          totalEvents: { $sum: 1 },
          uniqueUsersSet: { $addToSet: '$userId' },
          lastEventAt: { $max: '$createdAt' },
        },
      },
      {
        $project: {
          _id: 0,
          clicks: 1,
          views: 1,
          saves: 1,
          totalEvents: 1,
          uniqueUsers: { $size: '$uniqueUsersSet' },
          lastEventAt: 1,
        },
      },
    ]);

    const usersAgg = await this.eventModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$userId',
          clicks: {
            $sum: {
              $cond: [
                { $eq: ['$eventType', PropertyEngagementEventType.CLICK] },
                1,
                0,
              ],
            },
          },
          views: {
            $sum: {
              $cond: [
                { $eq: ['$eventType', PropertyEngagementEventType.VIEW] },
                1,
                0,
              ],
            },
          },
          saves: {
            $sum: {
              $cond: [
                { $eq: ['$eventType', PropertyEngagementEventType.SAVE] },
                1,
                0,
              ],
            },
          },
          totalEvents: { $sum: 1 },
          lastEventAt: { $max: '$createdAt' },
        },
      },
      {
        $project: {
          _id: 0,
          userId: '$_id',
          clicks: 1,
          views: 1,
          saves: 1,
          totalEvents: 1,
          lastEventAt: 1,
        },
      },
      { $sort: { views: -1, clicks: -1, lastEventAt: -1 } },
    ]);

    const userIds = usersAgg
      .map((item: any) => this.toSafeText(item.userId))
      .filter(Boolean);

    const users = userIds.length
      ? await this.userModel
          .find({ _id: { $in: userIds } })
          .select('_id fullName role email')
          .lean()
      : [];

    const userMap = new Map(users.map((user: any) => [String(user._id), user]));

    const enrichedUsers = usersAgg.map((item: any) => {
      const userId = this.toSafeText(item.userId);
      const user = userMap.get(userId);

      return {
        userId,
        fullName:
          this.toSafeText(user?.fullName) || `User #${userId.slice(-6)}`,
        role: this.toSafeText(user?.role) || 'unknown',
        email: this.toSafeText(user?.email),
        clicks: Number(item.clicks) || 0,
        views: Number(item.views) || 0,
        saves: Number(item.saves) || 0,
        totalEvents: Number(item.totalEvents) || 0,
        lastEventAt: item.lastEventAt || null,
      };
    });

    return {
      property: {
        propertyId: String((property as any)._id),
        propertyTitle: this.normalizePropertyTitle(property),
      },
      totals:
        totalsAgg[0] ||
        ({
          clicks: 0,
          views: 0,
          saves: 0,
          totalEvents: 0,
          uniqueUsers: 0,
          lastEventAt: null,
        } as any),
      users: enrichedUsers,
      generatedAt: new Date().toISOString(),
    };
  }
}
