/** Форма process.env для fail-fast валидации; неизвестные ключи пробрасываются как есть */
type TEnvRecord = Record<string, string | undefined>;

/** Плейсхолдеры, с которыми в production запускаться нельзя */
const INSECURE_SECRETS = new Set(['replace-me-access-secret', 'changeme', 'secret']);

const read = (env: TEnvRecord, key: string): string => env[key]?.trim() ?? '';

/** Валидирует обязательные переменные и возвращает нормализованный набор для ConfigService */
export const validateEnv = (env: TEnvRecord): TEnvRecord => {
  const nodeEnv = read(env, 'NODE_ENV') || 'development';
  const isProd = nodeEnv === 'production';
  const errors: string[] = [];

  const jwtSecret = read(env, 'JWT_SECRET');
  if (!jwtSecret) {
    errors.push('JWT_SECRET обязателен');
  } else if (isProd) {
    if (INSECURE_SECRETS.has(jwtSecret)) {
      errors.push('JWT_SECRET в production не может быть плейсхолдером');
    }
    if (jwtSecret.length < 32) {
      errors.push('JWT_SECRET в production должен быть не короче 32 символов');
    }
  }

  const dbUrl = read(env, 'DATABASE_URL');
  if (!dbUrl) {
    errors.push('DATABASE_URL обязателен');
  }

  const sameSite = read(env, 'COOKIE_SAME_SITE') || 'lax';
  if (!['lax', 'strict', 'none'].includes(sameSite)) {
    errors.push('COOKIE_SAME_SITE должен быть lax | strict | none');
  }

  const cookieSecure = read(env, 'COOKIE_SECURE') === 'true';
  if (isProd && !cookieSecure) {
    errors.push('В production обязателен COOKIE_SECURE=true (refresh-cookie только по HTTPS)');
  }
  if (sameSite === 'none' && !cookieSecure) {
    errors.push('COOKIE_SAME_SITE=none требует COOKIE_SECURE=true (требование браузеров)');
  }

  const corsOrigin = read(env, 'CORS_ORIGIN');
  if (isProd && !corsOrigin) {
    errors.push('В production задай явный CORS_ORIGIN (без дефолта на localhost)');
  }

  if (errors.length > 0) {
    throw new Error(`Invalid environment:\n- ${errors.join('\n- ')}`);
  }

  return {
    ...env,
    NODE_ENV: nodeEnv,
    JWT_SECRET: jwtSecret,
    DATABASE_URL: dbUrl,
    COOKIE_SAME_SITE: sameSite,
    COOKIE_SECURE: cookieSecure ? 'true' : 'false',
    CORS_ORIGIN: corsOrigin || 'http://localhost:5180',
  };
};
