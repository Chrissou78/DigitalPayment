import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const dbUrl = process.env.DATABASE_URL;

export default new DataSource({
  type: 'postgres',
  ...(dbUrl
    ? { url: dbUrl }
    : {
        host: process.env.DB_HOST ?? 'localhost',
        port: parseInt(process.env.DB_PORT ?? '5432', 10),
        username: process.env.DB_USERNAME ?? 'payduka',
        password: process.env.DB_PASSWORD ?? 'payduka_secret',
        database: process.env.DB_DATABASE ?? 'payduka',
      }),
  ssl:
    process.env.DB_SSL === 'true'
      ? { rejectUnauthorized: false }
      : false,
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  logging: true,
});
