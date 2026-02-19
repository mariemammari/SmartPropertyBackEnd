import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { PropertyDocument } from './schemas/property.schema';
import { Model } from 'mongoose';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';

@Injectable()
export class PropertyService {

    constructor(@InjectModel('Property') private propertyModel: Model<PropertyDocument>) { }

    async create(createPropertyDto: CreatePropertyDto) {
        const property = new this.propertyModel(createPropertyDto);
        return property.save();
    }

    async findAll() {
        return this.propertyModel.find();
    }

    async findOne(id: string) {
    const property = await this.propertyModel.findById(id);
    if (!property) throw new NotFoundException('Property not found');
    return property;
  }

  
async update(id: string, updatePropertyDto: UpdatePropertyDto) {
    const property = await this.propertyModel.findByIdAndUpdate(
      id,
      updatePropertyDto,
      { new: true },
    );
    if (!property) throw new NotFoundException('Property not found');
    return property;
  }

   async remove(id: string) {
    const property = await this.propertyModel.findByIdAndDelete(id);
    if (!property) throw new NotFoundException('Property not found');
    return { message: 'Property deleted successfully' };
  }

  //searcgh with filters
 async findWithFilters(filters: any) {
  const query: any = {};

  // 🔹 Filtres dynamiques
  if (filters.type) query.type = filters.type;
  if (filters.status) query.status = filters.status;

  if (filters.priceMin || filters.priceMax) {
    query.price = {};
    if (filters.priceMin) query.price.$gte = Number(filters.priceMin);
    if (filters.priceMax) query.price.$lte = Number(filters.priceMax);
  }

  if (filters.roomsMin || filters.roomsMax) {
    query.rooms = {};
    if (filters.roomsMin) query.rooms.$gte = Number(filters.roomsMin);
    if (filters.roomsMax) query.rooms.$lte = Number(filters.roomsMax);
  }

  if (filters.sizeMin || filters.sizeMax) {
    query.size = {};
    if (filters.sizeMin) query.size.$gte = Number(filters.sizeMin);
    if (filters.sizeMax) query.size.$lte = Number(filters.sizeMax);
  }

  if (filters.city) {
    query.address = { $regex: filters.city, $options: 'i' }; // recherche insensible
  }

  // 🔹 Préparer la requête Mongoose
  let queryExec = this.propertyModel.find(query);

  // 🔹 Tri
  if (filters.sortBy) {
    const order = filters.order === 'desc' ? -1 : 1;
    queryExec = queryExec.sort({ [filters.sortBy]: order });
  }

  // 🔹 Pagination
  if (filters.limit && filters.limit !== 'all') {
    const limit = Number(filters.limit);
    const page = Number(filters.page) || 1;
    const skip = (page - 1) * limit;
    queryExec = queryExec.skip(skip).limit(limit);
  }

  //  Exécuter la requête
  return queryExec;
}



}
