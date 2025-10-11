import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

const env = createEnv({
  server: {
    // Database & Supabase
    DATABASE_URL: z.string().url('Invalid Database URL'),
    DIRECT_URL: z.string().url('Invalid Direct URL'),
    SUPABASE_ACCESS_TOKEN: z.string().min(1, 'Supabase Access Token is required'),

    // Security & Auth
    SECRET: z.string().min(12, 'Secret must be at least 12 characters'),
    AUTH_SECRET: z.string().min(12, 'Auth Secret must be at least 12 characters'),
    PASSWORD_PEPPER: z.string().min(12, 'Password Pepper must be at least 12 characters'),
    AUTH_COOKIE: z.literal('auth').default('auth'),
    SERVER_URL_KEY: z.literal('x-url').default('x-url'),
    SEVEN_DAYS: z.number().default(7),

    // Turnstile
    TURNSTILE_SECRET_KEY: z.string().min(1, 'Turnstile Secret Key is required'),
    TURNSTILE_SITE_KEY: z.string().min(1, 'Turnstile Site Key is required'),

    // External Services
    GITHUB_TOKEN: z.string().optional(),
    ARCJET_KEY: z.string().min(1, 'Arcjet Key is required'),

    // Node Environment
    NODE_ENV: z.enum(['development', 'production', 'test']),
    ANALYZE: z.string().optional(),

    // CSRF
    CSRF_SECRET: z.string().min(1, 'CSRF Secret is required'),
  },
  client: {
    // App Configuration
    NEXT_PUBLIC_APP_VERSION: z.string().min(1, 'App Version is required'),
    NEXT_PUBLIC_APP_URL: z.string().url('Invalid App URL').default('http://localhost:3000'),
    NEXT_PUBLIC_PROJECT_REGION: z.string().min(1, 'Project Region is required'),

    // Supabase
    NEXT_PUBLIC_SUPABASE_URL: z.string().url('Invalid Supabase URL'),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'Supabase Anon Key is required'),
    NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: z
      .string()
      .min(1, 'Supabase Service Role Key is required'),
    NEXT_PUBLIC_SUPABASE_JWT_SECRET: z.string().min(1, 'Supabase JWT Secret is required'),

    // Datadog
    NEXT_PUBLIC_DATADOG_APPLICATION_ID: z.string().min(1, 'Datadog Application ID is required'),
    NEXT_PUBLIC_DATADOG_CLIENT_TOKEN: z.string().min(1, 'Datadog Client Token is required'),
    NEXT_PUBLIC_DATADOG_SITE: z.string().min(1, 'Datadog Site is required'),

    // Google Services
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().min(1, 'Google Maps API Key is required'),
    NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID: z.string().min(1, 'Google Maps Map ID is required'),
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: z.string().min(1, 'Google Client ID is required'),
    NEXT_PUBLIC_GOOGLE_CLIENT_SECRET: z.string().min(1, 'Google Client Secret is required'),

    // Analytics
    NEXT_PUBLIC_GA_MEASUREMENT_ID: z.string().min(1, 'GA Measurement ID is required'),
    NEXT_PUBLIC_GA_TRACKING_ID: z.string().min(1, 'GA Tracking ID is required'),
    NEXT_PUBLIC_GTM_ID: z.string().min(1, 'GTM ID is required'),
    NEXT_PUBLIC_ADSENSE_ID: z.string().min(1, 'Adsense ID is required'),

    // Sentry
    NEXT_PUBLIC_SENTRY_DSN: z.string().min(1, 'Sentry DSN is required'),
    NEXT_PUBLIC_SENTRY_AUTH_TOKEN: z.string().min(1, 'Sentry Auth Token is required'),

    // Resend
    NEXT_PUBLIC_RESEND_API_KEY: z.string().min(1, 'Resend API Key is required'),
    NEXT_PUBLIC_RESEND_HOST: z.string().min(1, 'Resend Host is required'),
    NEXT_PUBLIC_RESEND_PORT: z.string().min(1, 'Resend Port is required'),
    NEXT_PUBLIC_RESEND_USERNAME: z.string().min(1, 'Resend Username is required'),
    NEXT_PUBLIC_RESEND_EMAIL_FROM: z.string().email('Invalid Resend Email From'),
    NEXT_PUBLIC_RESEND_EMAIL_TO: z.string().email('Invalid Resend Email To'),

    // Upstash
    NEXT_PUBLIC_UPSTASH_REDIS_REST_URL: z.string().url('Invalid Upstash Redis REST URL'),
    NEXT_PUBLIC_UPSTASH_REDIS_REST_TOKEN: z.string().min(1, 'Upstash Redis REST Token is required'),
  },
  runtimeEnv: {
    // Server variables
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    SECRET: process.env.SECRET,
    AUTH_SECRET: process.env.AUTH_SECRET,
    PASSWORD_PEPPER: process.env.PASSWORD_PEPPER,
    SUPABASE_ACCESS_TOKEN: process.env.SUPABASE_ACCESS_TOKEN,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    AUTH_COOKIE: process.env.AUTH_COOKIE,
    SERVER_URL_KEY: process.env.SERVER_URL_KEY,
    SEVEN_DAYS: process.env.SEVEN_DAYS,
    ARCJET_KEY: process.env.ARCJET_KEY,
    NODE_ENV: process.env.NODE_ENV,
    ANALYZE: process.env.ANALYZE,
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
    TURNSTILE_SITE_KEY: process.env.TURNSTILE_SITE_KEY,
    CSRF_SECRET: process.env.CSRF_SECRET,

    // Client variables
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_PROJECT_REGION: process.env.NEXT_PUBLIC_PROJECT_REGION,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_SUPABASE_JWT_SECRET: process.env.NEXT_PUBLIC_SUPABASE_JWT_SECRET,
    NEXT_PUBLIC_DATADOG_APPLICATION_ID: process.env.NEXT_PUBLIC_DATADOG_APPLICATION_ID,
    NEXT_PUBLIC_DATADOG_CLIENT_TOKEN: process.env.NEXT_PUBLIC_DATADOG_CLIENT_TOKEN,
    NEXT_PUBLIC_DATADOG_SITE: process.env.NEXT_PUBLIC_DATADOG_SITE,
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID,
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    NEXT_PUBLIC_GOOGLE_CLIENT_SECRET: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET,
    NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
    NEXT_PUBLIC_GA_TRACKING_ID: process.env.NEXT_PUBLIC_GA_TRACKING_ID,
    NEXT_PUBLIC_GTM_ID: process.env.NEXT_PUBLIC_GTM_ID,
    NEXT_PUBLIC_ADSENSE_ID: process.env.NEXT_PUBLIC_ADSENSE_ID,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_SENTRY_AUTH_TOKEN: process.env.NEXT_PUBLIC_SENTRY_AUTH_TOKEN,
    NEXT_PUBLIC_RESEND_API_KEY: process.env.NEXT_PUBLIC_RESEND_API_KEY,
    NEXT_PUBLIC_RESEND_HOST: process.env.NEXT_PUBLIC_RESEND_HOST,
    NEXT_PUBLIC_RESEND_PORT: process.env.NEXT_PUBLIC_RESEND_PORT,
    NEXT_PUBLIC_RESEND_USERNAME: process.env.NEXT_PUBLIC_RESEND_USERNAME,
    NEXT_PUBLIC_RESEND_EMAIL_FROM: process.env.NEXT_PUBLIC_RESEND_EMAIL_FROM,
    NEXT_PUBLIC_RESEND_EMAIL_TO: process.env.NEXT_PUBLIC_RESEND_EMAIL_TO,
    NEXT_PUBLIC_UPSTASH_REDIS_REST_URL: process.env.NEXT_PUBLIC_UPSTASH_REDIS_REST_URL,
    NEXT_PUBLIC_UPSTASH_REDIS_REST_TOKEN: process.env.NEXT_PUBLIC_UPSTASH_REDIS_REST_TOKEN,
  },
});

export default env;
export { env };
