import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'your-super-secret-jwt-key-change-in-production',
    });
  }

  async validate(payload: any) {
    console.log('🔐 JWT Strategy Validating payload:', payload);
    const user = await this.authService.validateUser(payload.sub);
    if (!user) {
      console.error('❌ User not found in database for sub:', payload.sub);
      throw new UnauthorizedException();
    }
    console.log('✅ User validated:', user.email);

    // Ensure role and other fields from payload are included
    return {
      id: (user as any)._id?.toString() || payload.sub,
      sub: payload.sub,
      email: user.email,
      role: user.role || payload.role,
      branchId: user.branchId,
      userId: (user as any)._id?.toString() || payload.sub,
    };
  }

}

