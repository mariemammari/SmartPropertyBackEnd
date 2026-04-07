import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-facebook';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor() {
    super({
      clientID: process.env.FACEBOOK_APP_ID || 'dummy_app_id',
      clientSecret: process.env.FACEBOOK_APP_SECRET || 'dummy_secret',
      callbackURL: 'http://localhost:3000/auth/facebook/callback',
      scope: ['email', 'public_profile'],
      profileFields: ['id', 'emails', 'name', 'photos'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: (err: any, user: any, info?: any) => void,
  ): Promise<any> {
    const { id, name, emails, photos } = profile;
    const user = {
      facebookId: id,
      email:
        emails && emails.length > 0 ? emails[0].value : `${id}@facebook.com`,
      firstName: name?.givenName || 'User',
      lastName: name?.familyName || '',
      picture: photos && photos.length > 0 ? photos[0].value : null,
    };
    done(null, user);
  }
}
