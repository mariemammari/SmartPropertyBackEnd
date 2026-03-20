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
} from '@nestjs/common';
import { UserService } from './user.service';
import { SignUpDto } from './dto/signup.dto';
import { UpdateUserDto } from './dto/update.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRole } from './schemas/user.schema';

@Controller('users')
export class UsersController {
  constructor(private readonly userService: UserService) { }

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
      throw new NotFoundException('User is not a branch manager or has no branch assigned');
    }
    return { branchId };
  }


  /**
 * Get all staff users (super_admin, branch_manager, real_estate_agent, accountant)
 */
  @Get('staff/all')

  async getAllStaff(): Promise<any> {
    const users = await this.userService.findAllStaff();
    const sanitizedUsers = users.map(user => {
      const { password, ...result } = user.toObject();
      return result;
    });
    return {
      message: 'Staff users retrieved successfully',
      count: sanitizedUsers.length,
      users: sanitizedUsers,
    };
  }

  /**
   * Get all client users
   */
  @Get('clients/all')

  async getAllClients(): Promise<any> {
    const users = await this.userService.findAllClients();
    const sanitizedUsers = users.map(user => {
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