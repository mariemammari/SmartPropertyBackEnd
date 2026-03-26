import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument, UserRole, UserStatus } from './schemas/user.schema';
import { SignUpDto } from './dto/signup.dto';
import { UpdateUserDto } from './dto/update.dto';

@Injectable()
export class UserService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) { }

  async create(signUpDto: SignUpDto): Promise<UserDocument> {
    const { firstName, lastName, email, phone, dateOfBirth, password, role, branchId } = signUpDto;

    console.log('Creating user with email:', email);

    // Check if user already exists
    const existingUser = await this.userModel.findOne({ email });
    if (existingUser) {
      console.log('User already exists:', email);
      throw new ConflictException('User with this email already exists');
    }

    // Determine actual role (default to CLIENT if not specified)
    const actualRole = role || UserRole.CLIENT;

    // Validate dateOfBirth for CLIENT
    if (actualRole === UserRole.CLIENT && !dateOfBirth) {
      throw new BadRequestException('dateOfBirth is required for client role');
    }

    // Reject dateOfBirth for non-CLIENT roles
    if (actualRole !== UserRole.CLIENT && dateOfBirth) {
      throw new BadRequestException('dateOfBirth is only allowed for client role');
    }

    // Validate branchId for BRANCH_MANAGER
    if (actualRole === UserRole.BRANCH_MANAGER && !branchId) {
      throw new BadRequestException('branchId is required for branch_manager role');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create full name
    const fullName = `${firstName} ${lastName}`;

    // Create user
    const userData: any = {
      fullName,
      email,
      phone,
      password: hashedPassword,
      role: actualRole,
      status: UserStatus.ACTIVE,
      documents: [],
      managedProperties: [],
      savedProperties: [],
      Ai_riskScore: '',
      photo: '',
    };

    // Only add dateOfBirth for CLIENT
    if (actualRole === UserRole.CLIENT && dateOfBirth) {
      userData.dateOfBirth = new Date(dateOfBirth);
    }

    // Only add branchId for BRANCH_MANAGER
    if (actualRole === UserRole.BRANCH_MANAGER) {
      userData.branchId = branchId;
    }

    const user = new this.userModel(userData);
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

  async updateUser(id: string, updateData: UpdateUserDto): Promise<UserDocument> {
    // Get existing user first
    const existingUser = await this.findById(id);
    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    const { role, branchId, dateOfBirth } = updateData;

    // If currently branch_manager and changing to something else, clear branchId
    if (existingUser.role === UserRole.BRANCH_MANAGER && role && role !== UserRole.BRANCH_MANAGER) {
      updateData.branchId = undefined;
    }

    // If changing TO branch_manager, require branchId
    if (role === UserRole.BRANCH_MANAGER && !branchId) {
      throw new BadRequestException('branchId is required when role is branch_manager');
    }

    // If changing TO non-CLIENT, reject dateOfBirth
    if (role && role !== UserRole.CLIENT && dateOfBirth) {
      throw new BadRequestException('dateOfBirth is only allowed for client role');
    }

    // If currently CLIENT and changing to something else, clear dateOfBirth
    if (existingUser.role === UserRole.CLIENT && role && role !== UserRole.CLIENT) {
      updateData.dateOfBirth = undefined;
    }

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

  async deleteUser(id: string): Promise<void> {
    const result = await this.userModel.findByIdAndDelete(id);
    if (!result) {
      throw new NotFoundException('User not found');
    }
  }

  // NEW METHOD: Find branch for a manager
  async findManagerBranch(userId: string): Promise<string | null> {
    const user = await this.findById(userId);
    if (!user) return null;
    if (user.role !== UserRole.BRANCH_MANAGER) return null;
    return user.branchId || null;
  }

  /**
 * Find all users with staff roles (super_admin, branch_manager, real_estate_agent, accountant)
 */
  async findAllStaff(): Promise<UserDocument[]> {
    const staffRoles = [
      UserRole.SUPER_ADMIN,
      UserRole.BRANCH_MANAGER,
      UserRole.REAL_ESTATE_AGENT,
      UserRole.ACCOUNTANT
    ];

    return this.userModel.find({ role: { $in: staffRoles } }).exec();
  }

  /**
   * Find all users with CLIENT role
   */
  async findAllClients(): Promise<UserDocument[]> {
    return this.userModel.find({ role: UserRole.CLIENT }).exec();
  }

  /**
   * Change password for a user
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<UserDocument> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify current password
    const isPasswordValid = await this.validatePassword(
      currentPassword,
      user.password || '',
    );
    if (!isPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update user with new password
    const updatedUser = await this.userModel.findByIdAndUpdate(
      userId,
      { password: hashedNewPassword },
      { new: true },
    );

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    return updatedUser;
  }

  /**
   * Update user photo URL (photo already uploaded to Cloudinary by client)
   */
  async updatePhotoUrl(userId: string, photoUrl: string): Promise<string> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!photoUrl || typeof photoUrl !== 'string') {
      throw new BadRequestException('Invalid photo URL');
    }

    const updatedUser = await this.userModel.findByIdAndUpdate(
      userId,
      { photo: photoUrl },
      { new: true },
    );

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    return photoUrl;
  }

  /**
   * Upload photo to Cloudinary and save URL to user profile (legacy method)
   */
  async uploadPhoto(
    userId: string,
    fileBuffer: Buffer,
    mimetype: string,
  ): Promise<string> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Fallback: Store as base64 in MongoDB for development/testing
    const base64Photo = `data:${mimetype};base64,${fileBuffer.toString('base64')}`;

    const updatedUser = await this.userModel.findByIdAndUpdate(
      userId,
      { photo: base64Photo },
      { new: true },
    );

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    return base64Photo;
  }

}

