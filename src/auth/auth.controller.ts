import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Get, Request, Res } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { SignUpDto } from '../user/dto/signup.dto';
import { SignInDto } from '../user/dto/signin.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UserDocument } from '../user/schemas/user.schema';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signUp(@Body() signUpDto: SignUpDto) {
    console.log('SignUp request received:', signUpDto);
    try {
      const result = await this.authService.signUp(signUpDto);
      console.log('SignUp successful, user created:', result.user.id);
      return result;
    } catch (error) {
      console.error('SignUp error:', error);
      throw error;
    }
  }

  @Post('signin')
  @HttpCode(HttpStatus.OK)
  async signIn(@Body() signInDto: SignInDto) {
    console.log('SignIn request received for:', signInDto.email);
    try {
      const result = await this.authService.signIn(signInDto);
      console.log('SignIn successful for:', signInDto.email);
      return result;
    } catch (error) {
      console.error('SignIn error:', error);
      throw error;
    }
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    console.log('Forgot password request received for:', forgotPasswordDto.email);
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    console.log('Reset password request received');
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Request() req) {
    // Guards redirect
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Request() req, @Res() res) {
    const result = await this.authService.validateOAuthLogin(req.user, 'google');
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return res.redirect(`${frontendUrl}/oauth/callback?token=${result.access_token}&user=${encodeURIComponent(JSON.stringify(result.user))}`);
  }

  @Get('facebook')
  @UseGuards(AuthGuard('facebook'))
  async facebookAuth(@Request() req) {
    // Guards redirect
  }

  @Get('facebook/callback')
  @UseGuards(AuthGuard('facebook'))
  async facebookAuthRedirect(@Request() req, @Res() res) {
    const result = await this.authService.validateOAuthLogin(req.user, 'facebook');
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return res.redirect(`${frontendUrl}/oauth/callback?token=${result.access_token}&user=${encodeURIComponent(JSON.stringify(result.user))}`);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req) {
    const user = req.user as UserDocument & { _id: any };
    return {
      id: user._id.toString(),
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      photo: user.photo,
    };
  }
}

