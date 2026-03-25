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

    // Validate dateOfBirth for CLIENT (keep as required for clients if needed, or make optional)
    // The user said "tous les users avoir date of birth", so I'll make it optional for everyone but allow it for everyone.
    // If it was required for clients, I'll keep that if it doesn't conflict.
    // Actually, I'll just remove the rejection for non-clients.

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

    // Add dateOfBirth if provided (for any role)
    if (dateOfBirth) {
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

    // removed restriction on dateOfBirth

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

}

