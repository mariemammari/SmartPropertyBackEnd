import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession } from 'mongoose';
import {
  PropertyListing,
  PropertyListingDocument,
} from '../../property-listing/schemas/property-listing.schema';
import { User, UserDocument, UserRole, UserStatus } from '../../user/schemas/user.schema';

export interface AssignmentResult {
  success: boolean;
  assignedAgentId?: Types.ObjectId;
  warning?: string;
  message?: string;
}

export interface WorkloadSnapshot {
  agentId: Types.ObjectId;
  fullName: string;
  workload: number;
  lastAssignedAt?: Date;
}

@Injectable()
export class AssignmentService {
  private logger = new Logger(AssignmentService.name);

  constructor(
    @InjectModel(PropertyListing.name)
    private listingModel: Model<PropertyListingDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
  ) {}

  /**
   * Calculate workload for a given agent:
   * Count of pending_review + under_review submissions assigned to them.
   */
  private async calculateAgentWorkload(
    agentId: Types.ObjectId,
  ): Promise<number> {
    const count = await this.listingModel.countDocuments({
      assignedAgentId: agentId,
      status: { $in: ['pending_review', 'under_review'] },
    });
    return count;
  }

  /**
   * Get all eligible agents for a branch.
   * Criteria:
   *  - role = 'real_estate_agent'
   *  - status = 'active'
   *  - branchId matches
   */
  private async getEligibleAgents(
    branchId: string,
  ): Promise<UserDocument[]> {
    return this.userModel.find({
      branchId: branchId,
      role: UserRole.REAL_ESTATE_AGENT,
      status: UserStatus.ACTIVE,
    });
  }

  /**
   * Least-loaded assignment algorithm:
   * 1. Get all eligible agents
   * 2. Calculate workload for each
   * 3. Pick agent with minimal workload
   * 4. Tie-breaker: oldest lastAssignedAt first
   * 5. Final tie-breaker: ascending by _id
   */
  async findBestAgentForAssignment(
    branchId: string,
  ): Promise<AssignmentResult> {
    // Validate branch exists (simple check)
    if (!branchId) {
      throw new BadRequestException('branchId is required');
    }

    const eligibleAgents = await this.getEligibleAgents(branchId);

    if (eligibleAgents.length === 0) {
      this.logger.warn(
        `No eligible agents found for branchId: ${branchId}`,
      );
      return {
        success: false,
        warning: 'No eligible agents available in this branch',
        message: 'Request will remain unassigned',
      };
    }

    // Calculate workload for each agent
    const workloads: WorkloadSnapshot[] = [];
    for (const agent of eligibleAgents) {
      const workload = await this.calculateAgentWorkload(agent._id);
      workloads.push({
        agentId: agent._id,
        fullName: agent.fullName,
        workload,
        lastAssignedAt: agent.lastAssignedAt,
      });
    }

    // Sort by:
    // 1. workload (ascending)
    // 2. lastAssignedAt (oldest first, nulls first)
    // 3. _id (ascending, for determinism)
    workloads.sort((a, b) => {
      if (a.workload !== b.workload) {
        return a.workload - b.workload;
      }
      // Tie on workload: oldest lastAssignedAt first
      const aTime = a.lastAssignedAt ? a.lastAssignedAt.getTime() : 0;
      const bTime = b.lastAssignedAt ? b.lastAssignedAt.getTime() : 0;
      if (aTime !== bTime) {
        return aTime - bTime;
      }
      // Final tie-breaker: _id ascending
      return a.agentId.toString().localeCompare(b.agentId.toString());
    });

    const selectedAgent = workloads[0];

    this.logger.debug(
      `Selected agent ${selectedAgent.fullName} (${selectedAgent.agentId}) ` +
        `with workload ${selectedAgent.workload}. Snapshot: ${JSON.stringify(workloads)}`,
    );

    return {
      success: true,
      assignedAgentId: selectedAgent.agentId,
    };
  }

  /**
   * Assign a listing to an agent and update lastAssignedAt.
   * Should be called within a transaction for safety.
   */
  async assignListingToAgent(
    listingId: string,
    agentId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<PropertyListingDocument> {
    const now = new Date();

    // Update listing
    const listing = await this.listingModel.findByIdAndUpdate(
      listingId,
      {
        assignedAgentId: agentId,
        assignmentStatus: 'assigned',
        assignedAt: now,
      },
      { new: true, session },
    );

    if (!listing) {
      throw new NotFoundException(`Listing ${listingId} not found`);
    }

    // Update agent's lastAssignedAt
    await this.userModel.findByIdAndUpdate(
      agentId,
      { lastAssignedAt: now },
      { session },
    );

    return listing;
  }

  /**
   * Leave listing unassigned and set assignmentStatus.
   */
  async leaveUnassigned(
    listingId: string,
    session?: ClientSession,
  ): Promise<PropertyListingDocument> {
    const listing = await this.listingModel.findByIdAndUpdate(
      listingId,
      {
        assignmentStatus: 'unassigned',
        assignedAgentId: null,
      },
      { new: true, session },
    );

    if (!listing) {
      throw new NotFoundException(`Listing ${listingId} not found`);
    }

    return listing;
  }
}
