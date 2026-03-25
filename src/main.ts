import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as dns from 'dns';
import * as dotenv from 'dotenv';

import { v2 as cloudinary } from 'cloudinary';
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

dotenv.config();


async function bootstrap() {
  dns.setServers(['8.8.8.8', '1.1.1.1']);

  const app = await NestFactory.create(AppModule);
  dns.setServers(['8.8.8.8', '1.1.1.1']);
  // Enable CORS for frontend communication
  app.enableCors({
    origin: [process.env.FRONTEND_URL || 'http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Enable validation pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  //avec mongo local 
  {/*app.enableCors({
    origin: 'http://localhost:5174', //  frontend Vite
  });*/}

  app.useGlobalPipes(new ValidationPipe({ transform: true }))

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🚀 Application is running on: ${await app.getUrl()}`);
  console.log(`📡 MongoDB URI: ${process.env.MONGODB_URI || 'mongodb://localhost:27017/smartproperty'}`);
  console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
}
bootstrap();
