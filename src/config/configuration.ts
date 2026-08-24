export interface AppConfig {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  frontendUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  databaseUrl: process.env.DATABASE_URL ?? '',
  frontendUrl: process.env.FRONTEND_URL ?? '',
  jwtSecret: process.env.JWT_SECRET ?? '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
});
