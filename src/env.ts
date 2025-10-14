import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

const env = createEnv({
  server: {
    // Node Environment
    NODE_ENV: z.enum(['development', 'test', 'production']),

    // External Services - Server Only
    GITHUB_TOKEN: z.string().optional(),
    WAKA_TIME_API_KEY: z.string().optional(),

    // Spotify (Server-side tokens)
    SPOTIFY_CLIENT_ID: z.string().optional(),
    SPOTIFY_CLIENT_SECRET: z.string().optional(),
    SPOTIFY_REFRESH_TOKEN: z.string().optional(),

    // Sentry
    SENTRY_AUTH_TOKEN: z.string().optional(),

    // Liveblocks (Server-side)
    LIVEBLOCKS_API_KEY_PROD: z.string().optional(),
    LIVEBLOCKS_API_KEY_DEV: z.string().optional(),

    // Vercel
    VERCEL_GIT_COMMIT_SHA: z.string().optional(),

    // Development
    REACT_EDITOR: z.string().optional(),

    // CSRF
    CSRF_SECRET: z.string().min(1, 'CSRF Secret is required'),

    // Admin
    ADMIN_API_TOKEN: z.string().min(1, 'Admin API Token is required'),

    // Cloudinary
    CLOUDINARY_URL: z.string().min(1, 'Cloudinary URL is required'),

    // Sanity CMS (Server-side token)
    SANITY_API_TOKEN: z.string().optional(),
  },
  client: {
    // Firebase Configuration
    NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1, 'Firebase API Key is required'),
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1, 'Firebase Auth Domain is required'),
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1, 'Firebase Project ID is required'),
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(1, 'Firebase Storage Bucket is required'),
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z
      .string()
      .min(1, 'Firebase Messaging Sender ID is required'),
    NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1, 'Firebase App ID is required'),
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: z.string().min(1, 'Firebase Measurement ID is required'),

    // Google Maps (optional in development, required in production)
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().optional().or(z.literal('')),
    NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID: z.string().optional().or(z.literal('')),

    // GCP Service Account
    NEXT_PUBLIC_GCP_PROJECT_ID: z.string().min(1, 'GCP Project ID is required'),
    NEXT_PUBLIC_GCP_PRIVATE_KEY_ID: z.string().min(1, 'GCP Private Key ID is required'),
    NEXT_PUBLIC_GCP_PRIVATE_KEY: z.string().min(1, 'GCP Private Key is required'),
    NEXT_PUBLIC_GCP_CLIENT_EMAIL: z.string().min(1, 'GCP Client Email is required'),
    NEXT_PUBLIC_GCP_CLIENT_ID: z.string().min(1, 'GCP Client ID is required'),
    NEXT_PUBLIC_GCP_CLIENT_X509_CERT_URL: z
      .string()
      .min(1, 'GCP Client X.509 Cert URL is required'),

    // Hashnode
    NEXT_PUBLIC_HASHNODE_TOKEN: z.string().min(1, 'Hashnode Token is required'),

    // Discord
    NEXT_PUBLIC_DISCORD_ID: z.string().min(1, 'Discord ID is required'),

    // Liveblocks (Public Key)
    NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY: z.string().min(1, 'Liveblocks Public Key is required'),

    // Sentry
    NEXT_PUBLIC_SENTRY_DSN: z.string().min(1, 'Sentry DSN is required'),

    // Upstash (Redis)
    NEXT_PUBLIC_UPSTASH_REDIS_REST_URL: z.string().min(1, 'Upstash Redis REST URL is required'),
    NEXT_PUBLIC_UPSTASH_REDIS_REST_TOKEN: z.string().min(1, 'Upstash Redis REST Token is required'),

    // Cloudinary
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: z.string().min(1, 'Cloudinary Cloud Name is required'),

    // Sanity CMS (Public config)
    NEXT_PUBLIC_SANITY_PROJECT_ID: z.string().min(1, 'Sanity Project ID is required'),
    NEXT_PUBLIC_SANITY_DATASET: z.string().default('production'),
    NEXT_PUBLIC_SANITY_API_VERSION: z.string().default('2024-10-14'),
  },
  runtimeEnv: {
    // Server variables
    NODE_ENV: process.env.NODE_ENV,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    WAKA_TIME_API_KEY: process.env.WAKA_TIME_API_KEY,
    SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID,
    SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET,
    SPOTIFY_REFRESH_TOKEN: process.env.SPOTIFY_REFRESH_TOKEN,
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
    LIVEBLOCKS_API_KEY_PROD: process.env.LIVEBLOCKS_API_KEY_PROD,
    LIVEBLOCKS_API_KEY_DEV: process.env.LIVEBLOCKS_API_KEY_DEV,
    VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA,
    REACT_EDITOR: process.env.REACT_EDITOR,
    CSRF_SECRET: process.env.CSRF_SECRET,
    ADMIN_API_TOKEN: process.env.ADMIN_API_TOKEN,
    CLOUDINARY_URL: process.env.CLOUDINARY_URL,
    SANITY_API_TOKEN: process.env.SANITY_API_TOKEN,

    // Client variables
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID,
    NEXT_PUBLIC_GCP_PROJECT_ID: process.env.NEXT_PUBLIC_GCP_PROJECT_ID,
    NEXT_PUBLIC_GCP_PRIVATE_KEY_ID: process.env.NEXT_PUBLIC_GCP_PRIVATE_KEY_ID,
    NEXT_PUBLIC_GCP_PRIVATE_KEY: process.env.NEXT_PUBLIC_GCP_PRIVATE_KEY,
    NEXT_PUBLIC_GCP_CLIENT_EMAIL: process.env.NEXT_PUBLIC_GCP_CLIENT_EMAIL,
    NEXT_PUBLIC_GCP_CLIENT_ID: process.env.NEXT_PUBLIC_GCP_CLIENT_ID,
    NEXT_PUBLIC_GCP_CLIENT_X509_CERT_URL: process.env.NEXT_PUBLIC_GCP_CLIENT_X509_CERT_URL,
    NEXT_PUBLIC_HASHNODE_TOKEN: process.env.NEXT_PUBLIC_HASHNODE_TOKEN,
    NEXT_PUBLIC_DISCORD_ID: process.env.NEXT_PUBLIC_DISCORD_ID,
    NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY: process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_UPSTASH_REDIS_REST_URL: process.env.NEXT_PUBLIC_UPSTASH_REDIS_REST_URL,
    NEXT_PUBLIC_UPSTASH_REDIS_REST_TOKEN: process.env.NEXT_PUBLIC_UPSTASH_REDIS_REST_TOKEN,
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    NEXT_PUBLIC_SANITY_PROJECT_ID: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
    NEXT_PUBLIC_SANITY_DATASET: process.env.NEXT_PUBLIC_SANITY_DATASET,
    NEXT_PUBLIC_SANITY_API_VERSION: process.env.NEXT_PUBLIC_SANITY_API_VERSION,
  },
});

export default env;
export { env };
