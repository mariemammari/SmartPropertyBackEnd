import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserPreference } from '../schema/user-preference.schema';
import { CreatePreferenceDto } from '../dtos/create-preference.dto';

@Injectable()
export class UserPreferenceService {
  constructor(
    @InjectModel(UserPreference.name) private preferenceModel: Model<UserPreference>,
  ) {}

  async savePreferences(userId: string, dto: CreatePreferenceDto) {
    return this.preferenceModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { ...dto, userId: new Types.ObjectId(userId) },
      { upsert: true, new: true },
    );
  }

  async getPreferences(userId: string) {
    return this.preferenceModel.findOne({ userId: new Types.ObjectId(userId) });
  }
}
