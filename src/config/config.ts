import { app } from '@/constants';

/**
 * @description This is the configuration for the app. Only client-side variables are allowed.
 */
import { env } from '@/env';

export const config = {
  app: {
    name: app.name,
    url: app.url,
    version: app.version,
  },
  firebase: {
    apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  },
  google: {
    maps: {
      apiKey: env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
      mapId: env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID,
    },
  },
  gcp: {
    projectId: env.NEXT_PUBLIC_GCP_PROJECT_ID,
    privateKeyId: env.NEXT_PUBLIC_GCP_PRIVATE_KEY_ID,
    privateKey: env.NEXT_PUBLIC_GCP_PRIVATE_KEY,
    clientEmail: env.NEXT_PUBLIC_GCP_CLIENT_EMAIL,
    clientId: env.NEXT_PUBLIC_GCP_CLIENT_ID,
    clientX509CertUrl: env.NEXT_PUBLIC_GCP_CLIENT_X509_CERT_URL,
  },
  liveblocks: {
    publicKey: env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY,
  },
  sentry: {
    dsn: env.NEXT_PUBLIC_SENTRY_DSN,
  },
  discord: {
    id: env.NEXT_PUBLIC_DISCORD_ID,
  },
  hashnode: {
    token: env.NEXT_PUBLIC_HASHNODE_TOKEN,
  },
  upstash: {
    redis: {
      restUrl: env.NEXT_PUBLIC_UPSTASH_REDIS_REST_URL,
      restToken: env.NEXT_PUBLIC_UPSTASH_REDIS_REST_TOKEN,
    },
  },
  cloudinary: {
    cloudName: env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  },
  sanity: {
    projectId: env.NEXT_PUBLIC_SANITY_PROJECT_ID,
    dataset: env.NEXT_PUBLIC_SANITY_DATASET,
    apiVersion: env.NEXT_PUBLIC_SANITY_API_VERSION,
  },
} as const;
