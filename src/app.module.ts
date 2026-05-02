import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MailerModule } from '@nestjs-modules/mailer';
import { LazyModuleLoader, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { SmartPropertyThrottlerGuard } from './common/guards/smart-throttler.guard';
import { FingerprintMiddleware } from './middleware/fingerprint.middleware';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
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
import { NearbyModule } from './nearby/nearby.module';
import { AiModule } from './ai/ai.module';
import { FinanceModule } from './finance/finance.module';
import { RentalModule } from './rental/rental.module';
import { RentalChatModule } from './rental-chat/rental-chat.module';
import { PropertyEngagementModule } from './property-engagement/property-engagement.module';
import { MailModule } from './mail/mail.module';
import { PropertySubmissionModule } from './property-submission/property-submission.module';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { RecommandationModule } from './Recommandation/RecommandationModule';

@Module({
  imports: [
    ThrottlerModule.forRoot([{
      ttl: 60000,   // 60 seconds (v6 uses milliseconds)
      limit: 300,   // default: allow faster navigation on general routes
    }]),
    PrometheusModule.register(),
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri:
          configService.get<string>('MONGODB_URI') ||
          'mongodb://localhost:27017/smartproperty',
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
          tls: { rejectUnauthorized: false },
        },
        defaults: {
          from: `"SmartProperty" <${configService.get<string>('EMAIL_FROM') || 'noreply@smartproperty.com'}>`,
        },
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UserModule,
    PropertyModule,
    PropertyListingModule,
    PropertyMediaModule,
    ChatModule,
    NotificationModule,
    NotificationsModule,
    NearbyModule,
    VisitsModule,
    BranchModule,
    ComplaintModule,
    ApplicationModule,
    AiModule,
    FinanceModule,
    PropertyEngagementModule,
    MailModule,
    RentalModule,
    RentalChatModule,
    PropertySubmissionModule,
    RecommandationModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    LazyModuleLoader,
    {
      provide: APP_GUARD,
      useClass: SmartPropertyThrottlerGuard, // Skips monitoring/webhook routes
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(FingerprintMiddleware).forRoutes('*');
  }
}
