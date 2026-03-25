import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { BasicAuthMiddleware } from './middleware/basic-auth.middleware';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

// Fix for crypto module issue in TypeORM
if (typeof (global as any).crypto === 'undefined') {
  (global as any).crypto = require('crypto');
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  const configService = app.get(ConfigService);

  // Use the Pino logger from the app context BEFORE any other configuration
  app.useLogger(app.get(Logger));

  // Global prefix and URI versioning → all routes available at /api/v{version}/...
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // Security middleware
  app.use(helmet());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // CORS configuration
  app.enableCors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle(configService.get('API_TITLE') || 'Order Flow')
    .setDescription(
      configService.get('API_DESCRIPTION') ||
        'API for processing orders with PostgreSQL, Redis and BullMQ. Built with NestJS.',
    )
    .setVersion(configService.get('API_VERSION') || '1.0.0')
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management endpoints')
    .addTag('orders', 'Order management endpoints')
    .addTag('admin', 'Admin endpoints')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Apply the middleware manually for the admin routes
  // This ensures it runs before any library routes (like BullBoard)
  const authMiddleware = new BasicAuthMiddleware(configService);
  // Protect BullBoard (Express-mounted, unaffected by global prefix)
  app.use('/admin/*path', (req, res, next) =>
    authMiddleware.use(req, res, next),
  );
  // Protect versioned AdminController routes
  app.use('/api/v1/admin/*path', (req, res, next) =>
    authMiddleware.use(req, res, next),
  );

  const port = configService.get('APP_PORT') || 3000;
  await app.listen(port);

  const logger = app.get(Logger);

  logger.log(
    `🚀 Application is running on: http://localhost:${port}`,
    'Bootstrap',
  );
  logger.log(
    `📚 Swagger documentation available at: http://localhost:${port}/api/docs`,
    'Bootstrap',
  );
  logger.log(
    `🔐 Bull Board dashboard available at: http://localhost:${port}/admin/queues (requires authentication)`,
    'Bootstrap',
  );

  console.log(`🚀 Application is running on: http://localhost:${port}`);
  console.log(
    `📚 Swagger documentation available at: http://localhost:${port}/api/docs`,
  );
  console.log(
    `🔐 Bull Board dashboard available at: http://localhost:${port}/admin/queues (requires authentication)`,
  );
}

bootstrap();
