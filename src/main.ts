import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const configService = app.get(ConfigService);

  const nodeEnv = configService.get<string>('nodeEnv', 'development');
  const port = configService.get<number>('port', 3000);
  const frontendUrl = configService.get<string>('frontendUrl', '');
  const isProduction = nodeEnv === 'production';

  app.use(helmet());

  const corsOrigins: (string | RegExp)[] = [frontendUrl].filter(Boolean);
  if (!isProduction) {
    // Allow any localhost port in non-production so local frontend dev
    // servers on varying ports aren't blocked.
    corsOrigins.push(/^http:\/\/localhost:\d+$/);
  }
  app.enableCors({ origin: corsOrigins, credentials: true });

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  app.enableShutdownHooks();

  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('SKAFF Academy API')
      .setDescription(
        'Backend API for the SKAFF Academy digital campus platform. This is the foundation phase — only infrastructure endpoints are implemented so far.',
      )
      .setVersion('0.1.0')
      .addTag('Health', 'Application liveness')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`Application is running on: ${await app.getUrl()}`);
  logger.log(`Environment: ${nodeEnv}`);
  logger.log(`Port: ${port}`);
}

bootstrap().catch((error: unknown) => {
  const logger = new Logger('Bootstrap');
  logger.error('Failed to start application', error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
