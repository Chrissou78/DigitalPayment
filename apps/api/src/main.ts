import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import helmet from "helmet";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const nodeEnv = config.get<string>("nodeEnv") ?? "development";
  const apiPrefix = config.get<string>("apiPrefix") ?? "api/v1";
  const port = config.get<number>("port") ?? 3000;

  // Security
  app.use(helmet());
  app.enableCors({
    origin: nodeEnv === "production"
      ? ["https://admin.payduka.xyz"]
      : true,
  });

  // Global prefix
  app.setGlobalPrefix(apiPrefix);

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(port);

  console.log(`
  ╔══════════════════════════════════════════╗
  ║         PayDuka API v0.1.0               ║
  ║         http://localhost:${port}/${apiPrefix}  ║
  ║         env: ${nodeEnv}              ║
  ╚══════════════════════════════════════════╝
  `);
}

bootstrap();
