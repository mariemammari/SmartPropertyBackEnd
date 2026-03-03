import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as dns from 'dns';
import * as dotenv from 'dotenv';
dotenv.config();


async function bootstrap() {
    dns.setServers(['8.8.8.8', '1.1.1.1']);

  const app = await NestFactory.create(AppModule);

  //avec mongo local 
    {/*app.enableCors({
    origin: 'http://localhost:5174', //  frontend Vite
  });*/}


  //now avec atlas 
  app.enableCors({
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  });

   

  // Swagger config
  const config = new DocumentBuilder()
    .setTitle('SmartProperty API')
    .setDescription('Test upload image Firebase')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
