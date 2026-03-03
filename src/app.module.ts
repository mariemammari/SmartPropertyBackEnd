import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PropertyModule } from './property/property.module';
import { MongooseModule } from '@nestjs/mongoose';
import { setDefaultResultOrder } from 'dns';
import { VisitsModule } from './visits/Visits.module';
import { ConfigModule, ConfigService } from '@nestjs/config';



@Module({
  imports: [PropertyModule,
    VisitsModule,


    //MongooseModule.forRoot('mongodb+srv://hana_fkiri:atlaspassword@clustermaria.0hligyc.mongodb.net/smartpropertydb?appName=ClusterMaria')

   MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
      }),
      inject: [ConfigService],
    }),

  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
/**
    * 
    * MongooseModule.forRoot('mongodb://localhost:27017/smartproperty')*/