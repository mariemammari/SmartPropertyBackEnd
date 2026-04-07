import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import * as dns from 'dns';
import * as dotenv from 'dotenv';
import * as express from 'express';
import { v2 as cloudinary } from 'cloudinary';

// Load environment variables once
dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Set DNS servers for improved DNS resolution performance
dns.setServers(['8.8.8.8', '1.1.1.1']);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Stripe webhook requires raw body for signature verification.
  app.use('/rentals/webhook/stripe', express.raw({ type: 'application/json' }));

  // Increase request body limit to 50MB for photo uploads
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Enable CORS for frontend communication
  app.enableCors({
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      'http://localhost:5174',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Enable global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Enable global exception filter for detailed error responses
  app.useGlobalFilters(new AllExceptionsFilter());

  // Setup Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Smart Property API')
    .setDescription('API documentation for Smart Property Backend')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🚀 Application is running on: ${await app.getUrl()}`);
  console.log(
    `📡 MongoDB URI: ${process.env.MONGODB_URI || 'mongodb://localhost:27017/smartproperty'}`,
  );
  console.log(
    `🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`,
  );
}
bootstrap();
