import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

/** Поднимает HTTP-сервер Nest: CORS, cookies, валидация, Swagger */
const bootstrap = async (): Promise<void> => {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.use(cookieParser());
  const origin = process.env.CORS_ORIGIN ?? 'http://localhost:5180';
  app.enableCors({ origin, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const isProd = process.env.NODE_ENV === 'production';
  // Swagger недоступен в production: не публикуем поверхность API наружу
  if (!isProd) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('3D WEB Racing Platform API')
      .setDescription('Auth, tracks, race results and leaderboard')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
};

void bootstrap();
