import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.setGlobalPrefix('api/v1');

  // Configure CORS with specific origins instead of wildcard
  const corsOrigins = configService.get<string>('CORS_ORIGIN', 'http://localhost:3000');
  const allowedOrigins = corsOrigins.split(',').map(s => s.trim());
  
  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('ServeNep API')
    .setDescription('The ServeNep Home Services Marketplace REST API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = configService.get<number>('port', 5000);
  await app.listen(port);
  console.log(`ServeNep Backend running on: http://localhost:${port}/api/v1`);
  console.log(`Swagger Docs available on: http://localhost:${port}/api/docs`);
}
bootstrap();