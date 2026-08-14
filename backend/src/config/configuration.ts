export default () => {
  // Fail fast in production if critical env vars are missing
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.JWT_SECRET) {
      throw new Error('FATAL: JWT_SECRET environment variable is required in production');
    }
    // Managed Postgres hosts (Neon, Render, Railway, ...) hand out one
    // connection string rather than separate host/port/user/pass fields —
    // either form is accepted, but one of them must be set.
    if (!process.env.DATABASE_URL && !process.env.DATABASE_PASSWORD) {
      throw new Error('FATAL: DATABASE_URL or DATABASE_PASSWORD environment variable is required in production');
    }
  }

  return {
    port: parseInt(process.env.PORT, 10) || 5000,
    nodeEnv: process.env.NODE_ENV || 'development',
    database: {
      url: process.env.DATABASE_URL || undefined,
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT, 10) || 5432,
      username: process.env.DATABASE_USERNAME || 'postgres',
      password: process.env.DATABASE_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : 'postgres'),
      database: process.env.DATABASE_NAME || 'servenep',
      // No migration system exists yet, so schema sync stays on by default
      // even in production — set DB_SYNCHRONIZE=false once the schema is
      // stable and you don't want TypeORM altering tables on every deploy.
      synchronize: process.env.DB_SYNCHRONIZE ? process.env.DB_SYNCHRONIZE === 'true' : true,
    },
    jwt: {
      secret: process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'servenep-super-secret-jwt-key'),
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    },
    esewa: {
      merchantCode: process.env.ESEWA_MERCHANT_CODE || 'EPAYTEST',
      secretKey: process.env.ESEWA_SECRET_KEY || '8g8D8h8H8a8s8d8',
      url: process.env.ESEWA_URL || 'https://uat.esewa.com.np/api/epay/main/v2/form',
    },
    khalti: {
      secretKey: process.env.KHALTI_SECRET_KEY || 'Key 1234567890abcdef1234567890abcdef',
      url: process.env.KHALTI_URL || 'https://a.khalti.com/api/v2/epayment/initiate/',
    },
    sms: {
      aakashToken: process.env.AAKASH_SMS_TOKEN || 'aakash-test-token',
    }
  };
};
