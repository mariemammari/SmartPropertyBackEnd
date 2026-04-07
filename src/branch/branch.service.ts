import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Branch } from './schemas/branch.schema';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class BranchService {
  constructor(@InjectModel(Branch.name) private branchModel: Model<Branch>) {}

  // CREATE
  async create(createBranchDto: CreateBranchDto): Promise<Branch> {
    const newBranch = new this.branchModel(createBranchDto);
    return newBranch.save();
  }

  // READ ALL
  async findAll(): Promise<Branch[]> {
    return this.branchModel.find().exec();
  }

  // READ ONE
  async findById(id: string): Promise<Branch | null> {
    return this.branchModel.findById(id).exec();
  }

  // UPDATE
  async update(
    id: string,
    updateBranchDto: UpdateBranchDto,
  ): Promise<Branch | null> {
    return this.branchModel
      .findByIdAndUpdate(id, updateBranchDto, { new: true })
      .exec();
  }

  // DELETE
  async delete(id: string): Promise<Branch | null> {
    return this.branchModel.findByIdAndDelete(id).exec();
  }
}
