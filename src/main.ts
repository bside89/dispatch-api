import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { BasicAuthMiddleware } from './middleware/basic-auth.middleware';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AllExceptionsFilter } from './shared/filters/http-exception.filter';
import { DataSource } from 'typeorm';
import { seedMockAdminUser } from './shared/helpers/seed-mock-admin-user.helper';
import { seedMockItems } from './shared/helpers/seed-mock-items.helper';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });
  const configService = app.get(ConfigService);
  const dataSource = app.get(DataSource);
  const logger = app.get(Logger);

  // Global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Use the Pino logger from the app context BEFORE any other configuration
  app.useLogger(app.get(Logger));

  // Security middleware — disable CSP for Bull Board (it uses inline scripts/styles)
  app.use('/bull-board', helmet({ contentSecurityPolicy: false }));
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
        },
      },
    }),
  );

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
    origin: configService.get('TEST_ENV') === 'true' ? '*' : 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'idempotency-key',
      'stripe-signature',
    ],
  });

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle(configService.get('API_TITLE') || 'Order Flow')
    .setDescription(
      configService.get('API_DESCRIPTION') ||
        'API for processing orders with PostgreSQL, Redis and BullMQ. Built with NestJS.',
    )
    .setVersion(configService.get('API_VERSION') || '1.0.0')
    .addTag('default', 'App default endpoints')
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management endpoints')
    .addTag('orders', 'Order management endpoints')
    .addTag('items', 'Item management endpoints')
    .addTag('payments', 'Payment processing endpoints')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Apply the middleware manually for the protected routes
  const authMiddleware = new BasicAuthMiddleware(configService);

  // Seed mock data before the application starts accepting requests
  await seedMockAdminUser(configService, dataSource, logger);
  await seedMockItems(configService, dataSource, logger);

  // Protect Bull Board
  app.use('/bull-board', (req, res, next) => authMiddleware.use(req, res, next));

  const port = configService.get('APP_PORT') || 3000;
  const grafanaPort = configService.get('GRAFANA_PORT') || 3001;

  app.enableShutdownHooks();

  await app.listen(port);

  logger.log(`Application is running on: http://localhost:${port}`, 'Bootstrap');
  logger.log(
    `Swagger documentation available at: http://localhost:${port}/api/docs`,
    'Bootstrap',
  );
  logger.log(
    `Bull Board dashboard available at: http://localhost:${port}/bull-board (requires authentication)`,
    'Bootstrap',
  );
  logger.log(
    `Grafana dashboard available at: http://localhost:${grafanaPort} (requires authentication)`,
    'Bootstrap',
  );
  if (configService.get('TEST_ENV') === 'true') {
    logger.warn(
      'TEST_ENV is set to true. Rate limiting is disabled, so the application may be vulnerable to abuse. Make sure to set TEST_ENV to false in production!',
      'Bootstrap',
    );
  }

  console.log(`Application is running on: http://localhost:${port}`);
  console.log(
    `Swagger documentation available at: http://localhost:${port}/api/docs`,
  );
  console.log(
    `Bull Board dashboard available at: http://localhost:${port}/bull-board (requires authentication)`,
  );
  console.log(
    `Grafana dashboard available at: http://localhost:${grafanaPort} (requires authentication)`,
  );
  if (configService.get('TEST_ENV') === 'true') {
    console.warn(
      'TEST_ENV is set to true. Rate limiting is disabled, so the application may be vulnerable to abuse. Make sure to set TEST_ENV to false in production!',
    );
  }
}

bootstrap();
