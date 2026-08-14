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
    // Used to build payment gateway redirect URLs (eSewa success_url,
    // Khalti return_url) — must be the real frontend origin so the browser
    // lands back on the actual deployed site, not localhost.
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
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
      // EPAYTEST / 8g8D8h8H8a8s8d8 are eSewa's own published shared UAT
      // (sandbox) test credentials — safe to use as defaults since they're
      // meant for exactly this, unlike a real merchant secret.
      merchantCode: process.env.ESEWA_MERCHANT_CODE || 'EPAYTEST',
      secretKey: process.env.ESEWA_SECRET_KEY || '8g8D8h8H8a8s8d8',
      url: process.env.ESEWA_URL || 'https://rc-epay.esewa.com.np/api/epay/main/v2/form',
      statusCheckUrl: process.env.ESEWA_STATUS_URL || 'https://rc.esewa.com.np/api/epay/transaction/status/',
    },
    khalti: {
      // Unlike eSewa, Khalti has no shared public test key — sandbox testing
      // requires signing up at https://test-admin.khalti.com for your own
      // test secret key. Left unset by default; initiateKhaltiPayment throws
      // a clear error rather than pretending to work without one.
      secretKey: process.env.KHALTI_SECRET_KEY || '',
      baseUrl: process.env.KHALTI_BASE_URL || 'https://dev.khalti.com/api/v2',
    },
    sms: {
      aakashToken: process.env.AAKASH_SMS_TOKEN || 'aakash-test-token',
    },
    email: {
      // Real Gmail SMTP delivery for password-reset OTPs — requires a Gmail
      // account with 2FA enabled and an App Password (Google Account >
      // Security > 2-Step Verification > App passwords). A normal Gmail
      // password will NOT work here; Google blocks plain-password SMTP.
      gmailUser: process.env.GMAIL_USER || '',
      gmailAppPassword: process.env.GMAIL_APP_PASSWORD || '',
    },
  };
};
