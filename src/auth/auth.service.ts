import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MailerService } from '@nestjs-modules/mailer';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service';
import { SignInDto } from '../user/dto/signin.dto';
import { SignUpDto } from '../user/dto/signup.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UserDocument } from '../user/schemas/user.schema';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private mailerService: MailerService,
  ) {}

  async signUp(signUpDto: SignUpDto) {
    const user = await this.userService.create(signUpDto);
    const userId = (user as UserDocument & { _id: any })._id.toString();
    
    const payload = {
      sub: userId,
      email: user.email,
      role: user.role,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: userId,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        photo: user.photo,
      },
    };
  }

  async signIn(signInDto: SignInDto) {
    const user = await this.userService.findByEmail(signInDto.email);
    
    if (!user || (!user.password && (user.googleId || user.facebookId))) {
      throw new UnauthorizedException('Please login with your social account or provide valid credentials');
    }

    if (!user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await this.userService.validatePassword(
      signInDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('Account is not active');
    }

    const userId = (user as UserDocument & { _id: any })._id.toString();
    const payload = {
      sub: userId,
      email: user.email,
      role: user.role,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: userId,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        photo: user.photo,
      },
    };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    console.log(`[AuthService] Forgot password request for: ${forgotPasswordDto.email}`);
    
    try {
      const user = await this.userService.findByEmail(forgotPasswordDto.email);
      
      if (user) {
        let resetToken: string;
        try {
          resetToken = uuidv4();
        } catch (uuidErr) {
          console.error('[AuthService] UUID generation failed:', uuidErr);
          throw new Error('Internal error during token generation');
        }

        const resetExpires = new Date();
        resetExpires.setHours(resetExpires.getHours() + 1);

        console.log(`[AuthService] Generating reset token for ${user.email}`);
        await this.userService.updateUser((user as UserDocument & { _id: any })._id.toString(), {
          resetPasswordToken: resetToken,
          resetPasswordExpires: resetExpires,
        });

        const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
        console.log(`[AuthService] Attempting to send reset email to ${user.email}`);

        try {
          await this.mailerService.sendMail({
            to: user.email,
            subject: 'SmartProperty - Password Reset',
            text: `You requested a password reset. Please go to this link to reset your password: ${resetUrl}`,
            html: `<p>You requested a password reset.</p><p>Please <a href="${resetUrl}">click here</a> to reset your password.</p><p>If you did not request this, please ignore this email.</p>`,
          });
          console.log(`[AuthService] Password reset email successfully sent to ${user.email}`);
        } catch (mailErr) {
          console.error('[AuthService] SMTP Error:', mailErr);
          throw new Error(`Email sending failed: ${mailErr.message || 'Check SMTP configuration'}`);
        }
      } else {
        console.log(`[AuthService] No user found with email: ${forgotPasswordDto.email}`);
      }

      return { message: 'If that email address is in our database, we will send you an email to reset your password.' };
    } catch (err) {
      console.error('[AuthService] ForgotPassword catch-all error:', err);
      throw new BadRequestException(err.message || 'An error occurred during password reset');
    }
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const token = resetPasswordDto.token.trim();
    console.log(`[AuthService] Attempting to reset password with token: ${token}`);

    const user = await this.userService.findByResetToken(token);
    
    if (!user) {
      console.error(`[AuthService] Password reset failed: Token is invalid or expired. Token: ${token}`);
      // Check if token exists at all without date check (for debugging)
      const userWithToken = await (this.userService as any).userModel.findOne({ resetPasswordToken: token }).exec();
      if (userWithToken) {
        console.error(`[AuthService] Debug: Token found in DB but is EXPIRED. Expiration date: ${userWithToken.resetPasswordExpires}`);
      } else {
        console.error(`[AuthService] Debug: Token NOT found in database at all.`);
      }
      throw new BadRequestException('Invalid or expired password reset token');
    }

    console.log(`[AuthService] Token validated for user: ${user.email}`);
    const hashedPassword = await bcrypt.hash(resetPasswordDto.password, 10);

    const userId = (user as UserDocument & { _id: any })._id.toString();
    await this.userService.updateUser(userId, {
      password: hashedPassword,
      resetPasswordToken: undefined,
      resetPasswordExpires: undefined,
    });

    console.log(`[AuthService] Password successfully reset for user: ${user.email}`);
    return { message: 'Password has been successfully reset. You can now login.' };
  }

  async validateOAuthLogin(profile: any, provider: 'google' | 'facebook') {
    let user = await this.userService.findByEmail(profile.email);

    if (!user) {
      const signUpDto: any = {
        firstName: profile.firstName || 'User',
        lastName: profile.lastName || '',
        email: profile.email,
        phone: '00000000',
        password: '',
        state: '',
        city: '',
        dateOfBirth: '',
        role: 'client', 
      };
      user = await this.userService.create(signUpDto);
    }
    
    const updateData: any = {};
    if (provider === 'google' && !user.googleId) updateData.googleId = profile.googleId;
    if (provider === 'facebook' && !user.facebookId) updateData.facebookId = profile.facebookId;
    if (!user.photo && profile.picture) updateData.photo = profile.picture;

    const userId = (user as UserDocument & { _id: any })._id.toString();

    if (Object.keys(updateData).length > 0) {
      user = await this.userService.updateUser(userId, updateData);
    }

    const payload = {
      sub: userId,
      email: user.email,
      role: user.role,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: userId,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        photo: user.photo,
      },
    };
  }

  async validateUser(userId: string) {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }
}

