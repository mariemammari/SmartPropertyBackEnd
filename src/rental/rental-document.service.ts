import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  RentalDocument,
  RentalDocumentDocument,
} from './schemas/rental-document.schema';
import { Rental, RentalDocument as RentalDoc } from './schemas/rental.schema';
import {
  CreateRentalDocumentDto,
  UpdateRentalDocumentDto,
} from './dto/create-rental-document.dto';

@Injectable()
export class RentalDocumentService {
  constructor(
    @InjectModel(RentalDocument.name)
    private documentModel: Model<RentalDocumentDocument>,
    @InjectModel(Rental.name)
    private rentalModel: Model<RentalDoc>,
  ) {}

  /**
   * Create/upload a rental document
   * Accessible by: agent, owner, accountant, maintenance worker
   */
  async create(
    dto: CreateRentalDocumentDto,
    userId: string,
  ): Promise<RentalDocumentDocument> {
    if (!dto.rentalId || !dto.documentUrl || !dto.documentType) {
      throw new BadRequestException(
        'rentalId, documentUrl, and documentType are required',
      );
    }

    // Verify rental exists
    const rental = await this.rentalModel.findById(
      new Types.ObjectId(dto.rentalId),
    );
    if (!rental) {
      throw new NotFoundException('Rental not found');
    }

    const visibleTo = dto.visibleToUserIds
      ? dto.visibleToUserIds.map((id) => new Types.ObjectId(id))
      : [];

    const document = new this.documentModel({
      rentalId: new Types.ObjectId(dto.rentalId),
      documentType: dto.documentType,
      title: dto.title,
      description: dto.description,
      documentUrl: dto.documentUrl,
      publicId: dto.publicId,
      fileName: dto.fileName,
      isPublic: dto.isPublic !== false, // Default to public
      visibleTo,
      expiresAt: dto.expiresAt,
      uploadedBy: new Types.ObjectId(userId),
      uploadedAt: new Date(),
      notes: `Uploaded by user ${userId}`,
    });

    return document.save();
  }

  /**
   * Get all documents for a rental
   * Filters by isPublic and visibleTo permissions
   */
  async findByRentalId(
    rentalId: string,
    userId?: string,
    documentType?: string,
  ): Promise<RentalDocumentDocument[]> {
    const query: any = {
      rentalId: new Types.ObjectId(rentalId),
      isDeleted: false,
    };

    if (documentType) {
      query.documentType = documentType;
    }

    // Get all documents regardless of visibility for now
    // Frontend will filter based on permissions
    const docs = await this.documentModel
      .find(query)
      .populate('uploadedBy', 'fullName email')
      .sort({ createdAt: -1 })
      .exec();

    // Filter by visibility if userId provided
    if (userId) {
      return docs.filter((doc) => {
        if (doc.isPublic) return true;
        if (doc.visibleTo?.some((id) => id.toString() === userId)) return true;
        if (doc.uploadedBy._id.toString() === userId) return true;
        return false;
      });
    }

    return docs;
  }

  /**
   * Get single document by ID
   */
  async findById(id: string, userId?: string): Promise<RentalDocumentDocument> {
    const document = await this.documentModel
      .findById(new Types.ObjectId(id))
      .populate('uploadedBy', 'fullName email')
      .exec();

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // Check visibility
    if (
      userId &&
      !document.isPublic &&
      !document.visibleTo?.includes(new Types.ObjectId(userId))
    ) {
      if (document.uploadedBy._id.toString() !== userId) {
        throw new NotFoundException('Document not accessible');
      }
    }

    return document;
  }

  /**
   * Update document metadata
   */
  async update(
    id: string,
    dto: UpdateRentalDocumentDto,
    userId: string,
  ): Promise<RentalDocumentDocument> {
    const document = await this.findById(id, userId);

    // Check if user is the uploader (can update) or is admin
    if (document.uploadedBy._id.toString() !== userId) {
      throw new BadRequestException('Only document uploader can modify');
    }

    if (dto.title) document.title = dto.title;
    if (dto.description) document.description = dto.description;
    if (dto.isPublic !== undefined) document.isPublic = dto.isPublic;
    if (dto.visibleToUserIds) {
      document.visibleTo = dto.visibleToUserIds.map(
        (id) => new Types.ObjectId(id),
      );
    }
    if (dto.expiresAt) document.expiresAt = dto.expiresAt;
    if (dto.notes) document.notes = dto.notes;

    document.updatedAt = new Date();

    return document.save();
  }

  /**
   * Delete document (soft delete)
   */
  async delete(id: string, userId: string): Promise<RentalDocumentDocument> {
    const document = await this.findById(id, userId);

    // Check if user is uploader
    if (document.uploadedBy._id.toString() !== userId) {
      throw new BadRequestException('Only document uploader can delete');
    }

    document.isDeleted = true;
    document.deletedAt = new Date();

    return document.save();
  }

  /**
   * Check and archive expired documents
   * Called by scheduler to auto-archive time-sensitive docs
   */
  async autoArchiveExpired(): Promise<number> {
    const now = new Date();

    const result = await this.documentModel.updateMany(
      {
        expiresAt: { $lt: now },
        isArchived: false,
      },
      {
        isArchived: true,
        archivedAt: now,
      },
    );

    return result.modifiedCount;
  }

  /**
   * Get document for download
   * Returns URL for file download
   */
  async getDownloadUrl(
    id: string,
    userId?: string,
  ): Promise<{ url: string; fileName: string }> {
    const document = await this.findById(id, userId);

    const downloadUrl = `${document.documentUrl}?fl_attachment:${document.fileName || 'document.pdf'}`;

    return {
      url: downloadUrl,
      fileName:
        document.fileName || `${document.documentType}_${document._id}.pdf`,
    };
  }
}
