export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  database: {
    url: process.env.DATABASE_URL,
    directUrl: process.env.DIRECT_URL,
  },
  jwt: {
    secret: process.env.JWT_SECRET || "blackticket_secret_jwt_key_mvp_99",
    refreshSecret: process.env.JWT_REFRESH_SECRET || "blackticket_refresh_jwt_key_mvp_99",
    expiresIn: process.env.JWT_EXPIRES_IN || "1h",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  },
  redis: {
    // REDIS_URL takes priority (Upstash TLS). Falls back to host/port for local Docker.
    url: process.env.REDIS_URL || null,
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  },
  payments: {
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || "rzp_test_mockKeyId123",
    razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || "mockRazorpaySecret123",
  },
  storage: {
    awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || "mockAccessKeyId",
    awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "mockSecretKey",
    awsRegion: process.env.AWS_REGION || "ap-south-1",
    s3Bucket: process.env.AWS_S3_BUCKET || "blackticket-mvp-tickets",
  },
});
