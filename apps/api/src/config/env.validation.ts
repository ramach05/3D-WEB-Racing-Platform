/** process.env shape for fail-fast validation; unknown keys pass through as-is */
type TEnvRecord = Record<string, string | undefined>;

/** Placeholders that must not be used to boot in production */
const INSECURE_SECRETS = new Set(['replace-me-access-secret', 'changeme', 'secret']);

const read = (env: TEnvRecord, key: string): string => env[key]?.trim() ?? '';

/** Validates required variables and returns a normalized set for ConfigService */
export const validateEnv = (env: TEnvRecord): TEnvRecord => {
  const nodeEnv = read(env, 'NODE_ENV') || 'development';
  const isProd = nodeEnv === 'production';
  const errors: string[] = [];

  const jwtSecret = read(env, 'JWT_SECRET');
  if (!jwtSecret) {
    errors.push('JWT_SECRET is required');
  } else if (isProd) {
    if (INSECURE_SECRETS.has(jwtSecret)) {
      errors.push('JWT_SECRET cannot be a placeholder in production');
    }
    if (jwtSecret.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters long in production');
    }
  }

  const dbUrl = read(env, 'DATABASE_URL');
  if (!dbUrl) {
    errors.push('DATABASE_URL is required');
  }

  const sameSite = read(env, 'COOKIE_SAME_SITE') || 'lax';
  if (!['lax', 'strict', 'none'].includes(sameSite)) {
    errors.push('COOKIE_SAME_SITE must be one of lax | strict | none');
  }

  const cookieSecure = read(env, 'COOKIE_SECURE') === 'true';
  if (isProd && !cookieSecure) {
    errors.push('COOKIE_SECURE=true is required in production (refresh cookie over HTTPS only)');
  }
  if (sameSite === 'none' && !cookieSecure) {
    errors.push('COOKIE_SAME_SITE=none requires COOKIE_SECURE=true (browser requirement)');
  }

  const corsOrigin = read(env, 'CORS_ORIGIN');
  if (isProd && !corsOrigin) {
    errors.push('Set an explicit CORS_ORIGIN in production (no localhost default)');
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
