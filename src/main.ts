import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { BasicAuthMiddleware } from './middleware/basic-auth.middleware';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AllExceptionsFilter } from './shared/filters/exception.filter';
import { SeedDataService } from './shared/services/seed-data.service';

function configureSecurity(
  app: INestApplication,
  configService: ConfigService,
): void {
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
}

function configureSwagger(
  app: INestApplication,
  configService: ConfigService,
): void {
  const config = new DocumentBuilder()
    .setTitle(configService.get('API_TITLE') || 'Dispatch API')
    .setDescription(
      configService.get('API_DESCRIPTION') ||
        'API for processing orders with PostgreSQL, Redis and BullMQ. Built with NestJS.',
    )
    .setVersion(configService.get('API_VERSION') || '1.0.0')
    .addTag('default', 'App default endpoints')
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management endpoints')
    .addTag('users-admin', 'User management endpoints (admins only)')
    .addTag('orders', 'Order management endpoints')
    .addTag('orders-admin', 'Order management endpoints (admins only)')
    .addTag('items', 'Item management endpoints')
    .addTag('items-admin', 'Item management endpoints (admins only)')
    .addTag('payments', 'Payment processing endpoints')
    .addTag('notifications', 'User notifications endpoints')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });
  const configService = app.get(ConfigService);
  const logger = app.get(Logger);
  const seedDataService = app.get(SeedDataService);

  app.useLogger(logger);
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  configureSecurity(app, configService);
  configureSwagger(app, configService);

  const authMiddleware = new BasicAuthMiddleware(configService);
  app.use('/bull-board', (req, res, next) => authMiddleware.use(req, res, next));

  await seedDataService.run();

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
}

bootstrap();
