import { app } from '@/constants';
/**
 * @description This is the configuration for the app. Only client-side variables are allowed.
 */
import { env } from '@/env';

export const config = {
  app: {
    name: app.name,
    version: env.NEXT_PUBLIC_APP_VERSION,
    url: env.NEXT_PUBLIC_APP_URL,
    region: env.NEXT_PUBLIC_PROJECT_REGION,
  },
  supabase: {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRole: env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY,
    jwtSecret: env.NEXT_PUBLIC_SUPABASE_JWT_SECRET,
  },
  datadog: {
    applicationId: env.NEXT_PUBLIC_DATADOG_APPLICATION_ID,
    clientToken: env.NEXT_PUBLIC_DATADOG_CLIENT_TOKEN,
    site: env.NEXT_PUBLIC_DATADOG_SITE,
  },
  google: {
    maps: {
      apiKey: env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
      mapId: env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID,
    },
    auth: {
      clientId: env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      clientSecret: env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET,
    },
  },
  analytics: {
    ga: {
      measurementId: env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
      trackingId: env.NEXT_PUBLIC_GA_TRACKING_ID,
    },
    gtm: {
      id: env.NEXT_PUBLIC_GTM_ID,
    },
    adsense: {
      id: env.NEXT_PUBLIC_ADSENSE_ID,
    },
  },
  sentry: {
    dsn: env.NEXT_PUBLIC_SENTRY_DSN,
    authToken: env.NEXT_PUBLIC_SENTRY_AUTH_TOKEN,
  },
} as const;
