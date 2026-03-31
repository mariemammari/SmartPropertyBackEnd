import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MailerModule } from '@nestjs-modules/mailer';
import { LazyModuleLoader } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';

// Lazy-loaded modules (imported only here for reference)
import { ChatModule } from './chat/chat.module';
import { VisitsModule } from './visits/Visits.module';
import { PropertyModule } from './property/PropertyModule';
import { BranchModule } from './branch/branch.module';
import { ComplaintModule } from './complaint/complaint.module';
import { PropertyListingModule } from './property-listing/property-listing.module';
import { PropertyMediaModule } from './Property-Media/property-media.module';
import { NotificationModule } from './notification/notification.module';
import { ApplicationModule } from './application/application.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AiModule } from './ai/ai.module';
import { FinanceModule } from './finance/finance.module';


@Module({
  imports: [
    // Core/Essential Modules - Loaded Immediately
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI') || 'mongodb://localhost:27017/smartproperty',
      }),
      inject: [ConfigService],
    }),
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        transport: {
          host: configService.get<string>('SMTP_HOST'),
          port: configService.get<number>('SMTP_PORT'),
          secure: configService.get<number>('SMTP_PORT') == 465,
          auth: {
            user: configService.get<string>('SMTP_USER'),
            pass: configService.get<string>('SMTP_PASSWORD'),
          },
          tls: {
            rejectUnauthorized: false,
          },
        },
        defaults: {
          from: `"SmartProperty" <${configService.get<string>('EMAIL_FROM') || 'noreply@smartproperty.com'}>`,
        },
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UserModule,

    // Feature Modules - Lazy-Loaded on Demand
    PropertyModule,
    PropertyListingModule,
    PropertyMediaModule,
    ChatModule,
    NotificationModule,
    NotificationsModule,
    VisitsModule,
    BranchModule,
    ComplaintModule,
    ApplicationModule,
    AiModule,
    FinanceModule,

  ],
  controllers: [AppController],
  providers: [AppService, LazyModuleLoader],
})
export class AppModule { }
