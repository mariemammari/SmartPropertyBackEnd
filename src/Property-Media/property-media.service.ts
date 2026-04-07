import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import {
  PropertyMedia,
  PropertyMediaDocument,
  MediaTag,
} from '../Property-Media/schemas/property-media.schema';

@Injectable()
export class PropertyMediaService {
  constructor(
    @InjectModel(PropertyMedia.name)
    private mediaModel: Model<PropertyMediaDocument>,
  ) {}

  // ── Upload one or multiple images ─────────────────────────────────────────
  async uploadImages(
    files: Express.Multer.File[],
    propertyId: string,
    uploadedBy: string,
    listingId?: string,
    tag?: MediaTag,
  ): Promise<PropertyMedia[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    // Get current max order for this property
    const lastMedia = await this.mediaModel
      .findOne({ propertyId: new Types.ObjectId(propertyId) })
      .sort({ order: -1 });
    let order = lastMedia ? lastMedia.order + 1 : 0;

    const results: PropertyMedia[] = [];

    for (const file of files) {
      // Upload to Cloudinary
      const uploaded = await new Promise<any>((resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            {
              folder: `smart-property/${propertyId}`,
              resource_type: 'image',
              allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
              transformation: [{ quality: 'auto', fetch_format: 'auto' }],
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            },
          )
          .end(file.buffer);
      });

      // Save to DB
      const isFirst = order === 0 && results.length === 0;
      const media = await new this.mediaModel({
        propertyId: new Types.ObjectId(propertyId),
        listingId: listingId ? new Types.ObjectId(listingId) : undefined,
        uploadedBy: new Types.ObjectId(uploadedBy),
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
        tag: tag ?? MediaTag.OTHER,
        order,
        isPrimary: isFirst, // first uploaded image = primary
        width: uploaded.width,
        height: uploaded.height,
        sizeKb: Math.round(uploaded.bytes / 1024),
      }).save();

      results.push(media);
      order++;
    }

    return results;
  }

  // ── Get all images for a property ─────────────────────────────────────────
  async findByProperty(propertyId: string): Promise<PropertyMedia[]> {
    return this.mediaModel
      .find({
        propertyId: new Types.ObjectId(propertyId),
        isDeleted: false,
      })
      .sort({ order: 1 })
      .exec();
  }

  // ── Get all images for a listing ──────────────────────────────────────────
  async findByListing(listingId: string): Promise<PropertyMedia[]> {
    return this.mediaModel
      .find({
        listingId: new Types.ObjectId(listingId),
        isDeleted: false,
      })
      .sort({ order: 1 })
      .exec();
  }

  // ── Set primary image ─────────────────────────────────────────────────────
  async setPrimary(id: string, propertyId: string): Promise<PropertyMedia> {
    // Remove primary from all others
    await this.mediaModel.updateMany(
      { propertyId: new Types.ObjectId(propertyId) },
      { $set: { isPrimary: false } },
    );

    // Set new primary
    const media = await this.mediaModel
      .findByIdAndUpdate(id, { isPrimary: true }, { new: true })
      .exec();
    if (!media) throw new NotFoundException(`Media ${id} not found`);
    return media;
  }

  // ── Update order (drag & drop reorder) ───────────────────────────────────
  async reorder(items: { id: string; order: number }[]): Promise<void> {
    await Promise.all(
      items.map(({ id, order }) =>
        this.mediaModel.findByIdAndUpdate(id, { order }).exec(),
      ),
    );
  }

  // ── Soft delete ───────────────────────────────────────────────────────────
  async remove(id: string): Promise<void> {
    const media = await this.mediaModel.findById(id).exec();
    if (!media) throw new NotFoundException(`Media ${id} not found`);

    // Delete from Cloudinary
    if (media.publicId) {
      await cloudinary.uploader.destroy(media.publicId);
    }

    // Soft delete in DB
    await this.mediaModel
      .findByIdAndUpdate(id, {
        isDeleted: true,
        deletedAt: new Date(),
      })
      .exec();

    // If deleted was primary → set next one as primary
    if (media.isPrimary) {
      const next = await this.mediaModel
        .findOne({ propertyId: media.propertyId, isDeleted: false })
        .sort({ order: 1 })
        .exec();
      if (next)
        await this.mediaModel.findByIdAndUpdate(next._id, { isPrimary: true });
    }
  }
}
