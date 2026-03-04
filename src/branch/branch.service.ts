import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Branch, BranchDocument } from './schemas/branch.schema';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class BranchService {
  constructor(
    @InjectModel(Branch.name) private branchModel: Model<BranchDocument>,
  ) {}

  async create(createBranchDto: CreateBranchDto): Promise<Branch> {
    const branch = new this.branchModel(createBranchDto);
    return branch.save();
  }

  async findAll(): Promise<Branch[]> {
    return this.branchModel.find().exec();
  }

  async findOne(id: string): Promise<Branch> {
    const branch = await this.branchModel.findById(id).exec();
    if (!branch) throw new NotFoundException(`Branch #${id} not found`);
    return branch;
  }

  async update(id: string, updateBranchDto: UpdateBranchDto): Promise<Branch> {
    const branch = await this.branchModel
      .findByIdAndUpdate(id, updateBranchDto, { new: true })
      .exec();
    if (!branch) throw new NotFoundException(`Branch #${id} not found`);
    return branch;
  }

  async remove(id: string): Promise<{ message: string }> {
    const branch = await this.branchModel.findByIdAndDelete(id).exec();
    if (!branch) throw new NotFoundException(`Branch #${id} not found`);
    return { message: `Branch #${id} deleted successfully` };
  }
}