import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  NotFoundException,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UserService } from './user.service';
import { SignUpDto } from './dto/signup.dto';
import { UpdateUserDto } from './dto/update.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRole } from './schemas/user.schema';

@Controller('users')
export class UsersController {
  constructor(private readonly userService: UserService) {}

  /**
   * Create a new user (public registration)
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() signUpDto: SignUpDto): Promise<any> {
    const user = await this.userService.create(signUpDto);
    const { password, ...result } = user.toObject();
    return {
      message: 'User created successfully',
      user: result,
    };
  }

  /**
   * Get current authenticated user's profile
   */
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req): Promise<any> {
    const userId = req.user.userId || req.user._id || req.user.sub;
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const { password, ...result } = user.toObject();
    return result;
  }

  /**
   * Update current authenticated user's profile
   */
  @Put('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @Request() req,
    @Body() updateData: UpdateUserDto,
  ): Promise<any> {
    const userId = req.user.userId || req.user._id || req.user.sub;

    // Prevent sensitive updates through profile endpoint
    delete updateData.role;
    delete updateData.status;
    delete updateData.password;
    delete updateData.branchId;

    const user = await this.userService.updateUser(userId, updateData);
    const { password, ...result } = user.toObject();
    return {
      message: 'Profile updated successfully',
      user: result,
    };
  }

  /**
   * Upload profile photo
   */
  @Post('profile/photo')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('photo', { storage: memoryStorage() }))
  async uploadProfilePhoto(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<any> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const userId = req.user.userId || req.user._id || req.user.sub;
    const photoUrl = await this.userService.uploadPhoto(
      userId,
      file.buffer,
      file.mimetype,
    );

    return {
      message: 'Photo uploaded successfully',
      photoUrl,
    };
  }

  /**
   * Upload signature
   */
  @Post('profile/signature')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('signature', { storage: memoryStorage() }))
  async uploadSignature(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<any> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const userId = req.user.userId || req.user._id || req.user.sub;
    const signatureUrl = await this.userService.uploadSignature(
      userId,
      file.buffer,
      file.mimetype,
    );

    return {
      message: 'Signature uploaded successfully',
      signatureUrl,
    };
  }

  /**
   * Save photo URL (for client-side Cloudinary uploads)
   */
  @Post('profile/photo-url')
  @UseGuards(JwtAuthGuard)
  async savePhotoUrl(
    @Request() req,
    @Body() body: { photoUrl: string },
  ): Promise<any> {
    if (!body.photoUrl) {
      throw new BadRequestException('photoUrl is required');
    }

    const userId = req.user.userId || req.user._id || req.user.sub;
    const photoUrl = await this.userService.updatePhotoUrl(
      userId,
      body.photoUrl,
    );

    return {
      message: 'Photo URL saved successfully',
      photoUrl,
    };
  }

  /**
   * Save signature URL (for client-side Cloudinary uploads)
   */
  @Post('profile/signature-url')
  @UseGuards(JwtAuthGuard)
  async saveSignatureUrl(
    @Request() req,
    @Body() body: { signatureUrl: string },
  ): Promise<any> {
    if (!body.signatureUrl) {
      throw new BadRequestException('signatureUrl is required');
    }

    const userId = req.user.userId || req.user._id || req.user.sub;
    const signatureUrl = await this.userService.updateSignatureUrl(
      userId,
      body.signatureUrl,
    );

    return {
      message: 'Signature URL saved successfully',
      signatureUrl,
    };
  }

  /**
   * Change user password
   */
  @Put('profile/password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Request() req,
    @Body() body: { currentPassword: string; newPassword: string },
  ): Promise<any> {
    const userId = req.user.userId || req.user._id || req.user.sub;
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      throw new BadRequestException(
        'currentPassword and newPassword are required',
      );
    }

    await this.userService.changePassword(userId, currentPassword, newPassword);

    return {
      message: 'Password changed successfully',
    };
  }

  /**
   * Get user by ID
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findById(@Param('id') id: string): Promise<any> {
    const user = await this.userService.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    const { password, ...result } = user.toObject();
    return result;
  }

  /**
   * Update user by ID
   */
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async updateUser(
    @Param('id') id: string,
    @Body() updateData: UpdateUserDto,
  ): Promise<any> {
    const user = await this.userService.updateUser(id, updateData);
    const { password, ...result } = user.toObject();
    return {
      message: 'User updated successfully',
      user: result,
    };
  }

  /**
   * Update user by ID with branch assignment (admin only)
   */
  @Put('admin/:id')
  @UseGuards(JwtAuthGuard)
  async updateUserWithBranch(
    @Param('id') id: string,
    @Body() updateData: UpdateUserDto,
  ): Promise<any> {
    const user = await this.userService.updateUser(id, updateData);
    const { password, ...result } = user.toObject();
    return {
      message: 'User updated successfully with branch assignment',
      user: result,
    };
  }

  /**
   * Delete user by ID
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteUser(@Param('id') id: string): Promise<void> {
    await this.userService.deleteUser(id);
  }

  /**
   * Get branch for a specific manager
   */
  @Get(':id/branch')
  @UseGuards(JwtAuthGuard)
  async getUserBranch(@Param('id') id: string): Promise<any> {
    const branchId = await this.userService.findManagerBranch(id);
    if (!branchId) {
      throw new NotFoundException(
        'User is not a branch manager or has no branch assigned',
      );
    }
    return { branchId };
  }

  /**
   * Get all staff users (super_admin, branch_manager, real_estate_agent, accountant)
   */
  @Get('staff/all')
  @UseGuards(JwtAuthGuard)
  async getAllStaff(): Promise<any> {
    const users = await this.userService.findAllStaff();
    const sanitizedUsers = users.map((user) => {
      const { password, ...result } = user.toObject();
      return result;
    });
    return {
      message: 'Staff users retrieved successfully',
      users: sanitizedUsers,
    };
  }

  /**
   * Get branch staff for current branch manager (agents and accountants)
   */
  @Get('branch/staff')
  @UseGuards(JwtAuthGuard)
  async getBranchStaff(@Request() req): Promise<any> {
    const userId = req.user.userId || req.user._id || req.user.sub;

    // Get the current user to verify they're a branch manager
    const currentUser = await this.userService.findById(userId);
    if (!currentUser) {
      throw new NotFoundException('User not found');
    }

    if (currentUser.role !== UserRole.BRANCH_MANAGER) {
      throw new BadRequestException(
        'Only branch managers can access this endpoint',
      );
    }

    const branchId = currentUser.branchId;
    if (!branchId) {
      throw new BadRequestException('Branch manager has no branch assigned');
    }

    // Get all agents and accountants in this branch
    const branchStaff = await this.userService.findUsersByBranch(branchId);
    const sanitizedUsers = branchStaff.map((user) => {
      const { password, ...result } = user.toObject();
      return result;
    });

    return {
      message: 'Branch staff retrieved successfully',
      branchId,
      staff: sanitizedUsers,
    };
  }

  /**
   * Get all client users
   */
  @Get('clients/all')
  @UseGuards(JwtAuthGuard)
  async getAllClients(): Promise<any> {
    const users = await this.userService.findAllClients();
    const sanitizedUsers = users.map((user) => {
      const { password, ...result } = user.toObject();
      return result;
    });
    return {
      message: 'Client users retrieved successfully',
      count: sanitizedUsers.length,
      users: sanitizedUsers,
    };
  }
}
