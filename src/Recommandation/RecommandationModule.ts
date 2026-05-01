import { MongooseModule } from '@nestjs/mongoose';
import { UserPreference, UserPreferenceSchema } from './schema/user-preference.schema';
import { Module } from '@nestjs/common';
import { UserPreferenceController } from './UserPreferenceController';
import { UserPreferenceService } from './Services/UserPreferenceService';
import { HttpModule } from '@nestjs/axios';
import { RecommenderService } from './Services/recommender.service';

@Module({
  imports: [  
      HttpModule,


    MongooseModule.forFeature([{ name: UserPreference.name, schema: UserPreferenceSchema }]),
 
  ],
  controllers: [UserPreferenceController],
  providers: [UserPreferenceService,
 RecommenderService

  ],
})
export class RecommandationModule {}
