export default () => {
  // Fail fast in production if critical env vars are missing
  if (process.env.NODE_ENV === 'production') {
    const requiredVars = [
      { name: 'JWT_SECRET', value: process.env.JWT_SECRET },
      { name: 'DATABASE_PASSWORD', value: process.env.DATABASE_PASSWORD },
    ];
    for (const v of requiredVars) {
      if (!v.value) {
        throw new Error(`FATAL: ${v.name} environment variable is required in production`);
      }
    }
  }

  return {
    port: parseInt(process.env.PORT, 10) || 5000,
    nodeEnv: process.env.NODE_ENV || 'development',
    database: {
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT, 10) || 5432,
      username: process.env.DATABASE_USERNAME || 'postgres',
      password: process.env.DATABASE_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : 'postgres'),
      database: process.env.DATABASE_NAME || 'servenep',
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
