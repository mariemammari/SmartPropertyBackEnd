import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  RentalContract,
  RentalContractDocument,
} from './schemas/rental-contract.schema';
import { Rental, RentalDocument as RentalDoc } from './schemas/rental.schema';
import {
  CreateRentalContractDto,
  SignRentalContractDto,
  ContractSignerRole,
} from './dto/create-rental-contract.dto';

@Injectable()
export class RentalContractService {
  constructor(
    @InjectModel(RentalContract.name)
    private contractModel: Model<RentalContractDocument>,
    @InjectModel(Rental.name)
    private rentalModel: Model<RentalDoc>,
  ) {}

  /**
   * Create/upload a new contract version
   * Accountants, Agents, and Super Admins can upload
   */
  async create(
    dto: CreateRentalContractDto,
    userId: string,
    userRole: string,
  ): Promise<RentalContractDocument> {
    if (!dto.rentalId || !dto.documentUrl) {
      throw new BadRequestException('rentalId and documentUrl are required');
    }

    // Verify rental exists
    const rental = await this.rentalModel.findById(
      new Types.ObjectId(dto.rentalId),
    );
    if (!rental) {
      throw new NotFoundException('Rental not found');
    }

    // Get current version count
    const versionCount = await this.contractModel.countDocuments({
      rentalId: new Types.ObjectId(dto.rentalId),
    });

    const contract = new this.contractModel({
      rentalId: new Types.ObjectId(dto.rentalId),
      documentUrl: dto.documentUrl,
      publicId: dto.publicId,
      fileName: dto.fileName,
      version: versionCount + 1,
      uploadedBy: new Types.ObjectId(userId),
      notes: dto.notes || `Uploaded by ${userRole}`,
      expiresAt: this.calculateExpiryDate(rental.moveOutDate),
    });
    const savedContract = await contract.save();

    // Auto-progress rental lifecycle once the first contract exists.
    if (rental.status === 'pending') {
      await this.rentalModel
        .updateOne(
          { _id: rental._id, status: 'pending' },
          { $set: { status: 'rented' } },
        )
        .exec();
    }

    return savedContract;
  }

  /**
   * Get all versions of a rental contract
   */
  async findByRentalId(rentalId: string): Promise<RentalContractDocument[]> {
    return this.contractModel
      .find({ rentalId: new Types.ObjectId(rentalId) })
      .populate('uploadedBy', 'fullName email')
      .sort({ version: -1 })
      .exec();
  }

  /**
   * Get latest contract version
   */
  async findLatestByRentalId(
    rentalId: string,
  ): Promise<RentalContractDocument | null> {
    return this.contractModel
      .findOne({ rentalId: new Types.ObjectId(rentalId) })
      .populate('uploadedBy', 'fullName email')
      .sort({ version: -1 })
      .exec();
  }

  /**
   * Get single contract by ID
   */
  async findById(id: string): Promise<RentalContractDocument> {
    const contract = await this.contractModel
      .findById(new Types.ObjectId(id))
      .populate('uploadedBy', 'fullName email')
      .populate('signedBy', 'fullName email')
      .exec();

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    return contract;
  }

  /**
   * Sign contract as a user with explicit signer role (tenant, owner, agent)
   */
  async signContract(
    id: string,
    userId: string,
    dto?: SignRentalContractDto,
  ): Promise<RentalContractDocument> {
    if (!dto?.signerRole) {
      throw new BadRequestException(
        'signerRole is required (tenant, owner, or agent)',
      );
    }

    const contract = await this.contractModel
      .findById(new Types.ObjectId(id))
      .exec();
    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    // Add signer to signedBy array (avoid duplicates)
    const userObjId = new Types.ObjectId(userId);
    if (!contract.signedBy) {
      contract.signedBy = [];
    }
    if (!contract.signedBy.some((signerId) => signerId.toString() === userId)) {
      contract.signedBy.push(userObjId);
    }

    const signedAt = dto?.signedAt || new Date();

    // Write signature data to role-specific fields
    if (dto.signerRole === ContractSignerRole.TENANT) {
      contract.tenantSignedAt = signedAt;
      if (dto?.signatureImageUrl) {
        contract.tenantSignatureImageUrl = dto.signatureImageUrl;
      }
      if (dto?.signatureImagePublicId) {
        contract.tenantSignatureImagePublicId = dto.signatureImagePublicId;
      }
    } else if (dto.signerRole === ContractSignerRole.OWNER) {
      contract.ownerSignedAt = signedAt;
      if (dto?.signatureImageUrl) {
        contract.ownerSignatureImageUrl = dto.signatureImageUrl;
      }
      if (dto?.signatureImagePublicId) {
        contract.ownerSignatureImagePublicId = dto.signatureImagePublicId;
      }
    } else if (dto.signerRole === ContractSignerRole.AGENT) {
      contract.agentSignedAt = signedAt;
      if (dto?.signatureImageUrl) {
        contract.agentSignatureImageUrl = dto.signatureImageUrl;
      }
      if (dto?.signatureImagePublicId) {
        contract.agentSignatureImagePublicId = dto.signatureImagePublicId;
      }
    }

    contract.signedAt = signedAt;

    return contract.save();
  }

  /**
   * Download contract as PDF
   * Returns Cloudinary URL with attachment header
   */
  async getDownloadUrl(id: string): Promise<{ url: string; fileName: string }> {
    const contract = await this.findById(id);

    // Append attachment header to Cloudinary URL so browser downloads it
    const downloadUrl = `${contract.documentUrl}?fl_attachment:${contract.fileName || 'contract.pdf'}`;

    return {
      url: downloadUrl,
      fileName: contract.fileName || `contract_v${contract.version}.pdf`,
    };
  }

  /**
   * Archive old contracts
   */
  async archive(id: string): Promise<RentalContractDocument> {
    const contract = await this.findById(id);
    contract.isArchived = true;
    contract.archivedAt = new Date();
    return contract.save();
  }

  /**
   * Calculate legal hold expiry: moveOutDate + 7 years
   */
  private calculateExpiryDate(moveOutDate?: Date): Date {
    const date = moveOutDate ? new Date(moveOutDate) : new Date();
    date.setFullYear(date.getFullYear() + 7);
    return date;
  }
}
