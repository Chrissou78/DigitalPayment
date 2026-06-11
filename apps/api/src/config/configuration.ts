import { SnakeNamingStrategy } from 'typeorm-naming-strategies';


export default () => {
  const dbUrl = process.env.DATABASE_URL;
  const isProd = process.env.NODE_ENV === 'production';

  const database = dbUrl
    ? {
        type: 'postgres' as const,
        url: dbUrl,
        ssl:
          process.env.DB_SSL === 'true'
            ? { rejectUnauthorized: false }
            : false,
      }
    : {
        type: 'postgres' as const,
        host: process.env.DB_HOST ?? 'localhost',
        port: parseInt(process.env.DB_PORT ?? '5432', 10),
        username: process.env.DB_USERNAME ?? 'payduka',
        password: process.env.DB_PASSWORD ?? 'payduka_secret',
        database: process.env.DB_DATABASE ?? 'payduka',
        ssl:
          process.env.DB_SSL === 'true'
            ? { rejectUnauthorized: false }
            : false,
      };

  return {
    port: parseInt(process.env.PORT ?? '3000', 10),
    apiPrefix: process.env.API_PREFIX ?? 'api/v1',
    nodeEnv: process.env.NODE_ENV ?? 'development',

    database: {
      ...database,
      // CRITICAL: synchronize=false in production; use migrations instead
      autoLoadEntities: true,
      synchronize: false,
      namingStrategy: new SnakeNamingStrategy(),
      // In production, run compiled migrations from dist/
      migrations: isProd
        ? [__dirname + '/migrations/*{.js}']
        : [__dirname + '/migrations/*{.ts,.js}'],
      migrationsRun: isProd, // auto-run migrations on startup in production
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      logging: !isProd,
    },

    redis: {
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
    },

    jwt: {
      secret: process.env.JWT_SECRET ?? 'change-me',
      expiration: parseInt(process.env.JWT_EXPIRATION ?? '3600', 10),
    },

    stitch: {
      clientId: process.env.STITCH_CLIENT_ID ?? '',
      clientSecret: process.env.STITCH_CLIENT_SECRET ?? '',
      apiUrl: process.env.STITCH_API_URL ?? 'https://api.stitch.money/graphql',
      authUrl: process.env.STITCH_AUTH_URL ?? 'https://login.stitch.money/oauth/token',
      webhookSecret: process.env.STITCH_WEBHOOK_SECRET ?? '',
    },

    polygon: {
      rpcUrl: process.env.POLYGON_RPC_URL ?? 'https://polygon-rpc.com',
      settlementPrivateKey: process.env.SETTLEMENT_PRIVATE_KEY ?? '',
    },

    contracts: {
      token: process.env.PDUKA_TOKEN_ADDRESS ?? '',
      pool: process.env.PDUKA_POOL_ADDRESS ?? '',
      oracle: process.env.PDUKA_ORACLE_ADDRESS ?? '',
      treasury: process.env.PDUKA_TREASURY_ADDRESS ?? '',
      staking: process.env.STAKING_POOL_ADDRESS ?? '',
    },

    oracle: {
      pdukaUsdRate: parseFloat(process.env.PDUKA_USD_RATE ?? '0.005'),
    },

    rules: {
      transactionFeePercent: parseFloat(process.env.TRANSACTION_FEE_PERCENT ?? '1.5'),
      merchantReservePercent: parseFloat(process.env.MERCHANT_RESERVE_PERCENT ?? '5'),
      advanceFeePercent: parseFloat(process.env.ADVANCE_FEE_PERCENT ?? '1.5'),
      advanceMaxPercentOfVolume: parseFloat(process.env.ADVANCE_MAX_PERCENT_OF_VOLUME ?? '30'),
      refillThresholdCents: parseInt(process.env.REFILL_THRESHOLD_CENTS ?? '50000', 10),
      refillAmountCents: parseInt(process.env.REFILL_AMOUNT_CENTS ?? '100000', 10),
      stakingApyPercent: parseFloat(process.env.STAKING_APY_PERCENT ?? '12'),
    },

    admin: {
      defaultEmail: process.env.ADMIN_DEFAULT_EMAIL ?? 'admin@payduka.xyz',
      defaultPassword: process.env.ADMIN_DEFAULT_PASSWORD ?? 'change-me',
    },
  };
};
