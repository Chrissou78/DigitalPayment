import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Security
  app.use(helmet());
  app.enableCors({
    origin: config.get('nodeEnv') === 'production'
      ? ['https://admin.payduka.xyz']
      : true,
  });

  // Global prefix
  app.setGlobalPrefix(config.get<string>('apiPrefix'));

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = config.get<number>('port');
  await app.listen(port);

  console.log(`
  ╔══════════════════════════════════════════╗
  ║         PayDuka API v0.1.0               ║
  ║         http://localhost:${port}/${config.get('apiPrefix')}  ║
  ║         env: ${config.get('nodeEnv')}              ║
  ╚══════════════════════════════════════════╝
  `);
}

bootstrap();
