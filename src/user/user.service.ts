import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';
import { SignUpDto } from './dto/signup.dto';

@Injectable()
export class UserService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async create(signUpDto: SignUpDto): Promise<UserDocument> {
    const { firstName, lastName, email, phone, password, state, city, dateOfBirth, role } = signUpDto;

    console.log('Creating user with email:', email);

    // Check if user already exists
    const existingUser = await this.userModel.findOne({ email });
    if (existingUser) {
      console.log('User already exists:', email);
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create full name
    const fullName = `${firstName} ${lastName}`;

    // Create user
    const user = new this.userModel({
      fullName,
      email,
      phone,
      password: hashedPassword,
      role: role || 'tenant',
      status: 'active',
      properties: [],
      documents: [],
      managedProperties: [],
      savedProperties: [],
      Ai_riskScore: '',
      photo: '',
    });

    const savedUser = await user.save();
    console.log('User saved successfully:', savedUser._id.toString());
    return savedUser;
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async validatePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  async updateUser(id: string, updateData: Partial<User>): Promise<UserDocument> {
    const user = await this.userModel.findByIdAndUpdate(id, updateData, { new: true });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findByResetToken(token: string): Promise<UserDocument | null> {
    return this.userModel.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    }).exec();
  }
}

