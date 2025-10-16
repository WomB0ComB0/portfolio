import { app } from '@/constants';
import { env } from '@/env';

/**
 * @readonly
 * @const
 * @public
 * @type {object}
 * @description
 * Central configuration object for the portfolio client application (only client-safe variables included).
 * Includes environment-specific keys for Firebase, Google APIs, GCP, Sentry, Discord, Hashnode, Upstash, Cloudinary, and Sanity.
 * This config should be the singular source of truth for environment and runtime client-side settings across the app.
 *
 * @author Mike Odnis
 * @web
 * @version 1.0.0
 * @see https://github.com/WomB0ComB0/portfolio
 *
 * @example
 *   import { config } from '@/config/config';
 *   fetch(`https://maps.googleapis.com/maps/api/js?key=${config.google.maps.apiKey}`)
 */
export const config = {
  /**
   * @readonly
   * @public
   * @description Application identity metadata.
   * @type {{ name: string, url: string, version: string }}
   */
  app: {
    name: app.name,
    url: app.url,
    version: app.version,
  },
  /**
   * @readonly
   * @public
   * @description Publicly available Firebase client keys for connecting to Firebase services.
   * @type {{
   *   apiKey: string,
   *   authDomain: string,
   *   projectId: string,
   *   storageBucket: string,
   *   messagingSenderId: string,
   *   appId: string,
   *   measurementId?: string
   * }}
   * @see https://firebase.google.com/docs/web/setup
   */
  firebase: {
    apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  },
  /**
   * @readonly
   * @public
   * @description Google API keys for Maps functionality.
   * @type {{ maps: { apiKey: string, mapId: string } }}
   * @see https://developers.google.com/maps/documentation/javascript/get-api-key
   */
  google: {
    maps: {
      apiKey: env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
      mapId: env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID,
    },
  },
  /**
   * @readonly
   * @public
   * @description Google Cloud Platform service account credentials (client-exposed subset, do not use for server-side secrets).
   * @type {{
   *   projectId: string,
   *   privateKeyId: string,
   *   privateKey: string,
   *   clientEmail: string,
   *   clientId: string,
   *   clientX509CertUrl: string
   * }}
   * @see https://cloud.google.com/iam/docs/creating-managing-service-account-keys
   */
  gcp: {
    projectId: env.NEXT_PUBLIC_GCP_PROJECT_ID,
    privateKeyId: env.NEXT_PUBLIC_GCP_PRIVATE_KEY_ID,
    privateKey: env.NEXT_PUBLIC_GCP_PRIVATE_KEY,
    clientEmail: env.NEXT_PUBLIC_GCP_CLIENT_EMAIL,
    clientId: env.NEXT_PUBLIC_GCP_CLIENT_ID,
    clientX509CertUrl: env.NEXT_PUBLIC_GCP_CLIENT_X509_CERT_URL,
  },
  /**
   * @readonly
   * @public
   * @description Liveblocks public API key for real-time collaboration services.
   * @type {{ publicKey: string }}
   * @see https://liveblocks.io/docs/rooms/authentication/public-key
   */
  liveblocks: {
    publicKey: env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY,
  },
  /**
   * @readonly
   * @public
   * @description Sentry DSN for error tracking and monitoring.
   * @type {{ dsn: string }}
   * @see https://docs.sentry.io/product/sentry-basics/dsn-explainer/
   */
  sentry: {
    dsn: env.NEXT_PUBLIC_SENTRY_DSN,
  },
  /**
   * @readonly
   * @public
   * @description Discord application/client ID for integration.
   * @type {{ id: string }}
   * @see https://discord.com/developers/applications
   */
  discord: {
    id: env.NEXT_PUBLIC_DISCORD_ID,
  },
  /**
   * @readonly
   * @public
   * @description Hashnode API token for accessing blog resources.
   * @type {{ token: string }}
   * @see https://hashnode.com
   */
  hashnode: {
    token: env.NEXT_PUBLIC_HASHNODE_TOKEN,
  },
  /**
   * @readonly
   * @public
   * @description Upstash REST API credentials for managed Redis.
   * @type {{ redis: { restUrl: string, restToken: string } }}
   * @see https://docs.upstash.com/redis/
   */
  upstash: {
    redis: {
      restUrl: env.NEXT_PUBLIC_UPSTASH_REDIS_REST_URL,
      restToken: env.NEXT_PUBLIC_UPSTASH_REDIS_REST_TOKEN,
    },
  },
  /**
   * @readonly
   * @public
   * @description Cloudinary cloud name for image/media management.
   * @type {{ cloudName: string }}
   * @see https://cloudinary.com/documentation/cloudinary_end_to_end_image_management
   */
  cloudinary: {
    cloudName: env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  },
  /**
   * @readonly
   * @public
   * @description Sanity project keys for connecting to CMS datasets and APIs.
   * @type {{
   *   projectId: string,
   *   dataset: string,
   *   apiVersion: string
   * }}
   * @see https://www.sanity.io/docs/api-versioning
   */
  sanity: {
    projectId: env.NEXT_PUBLIC_SANITY_PROJECT_ID,
    dataset: env.NEXT_PUBLIC_SANITY_DATASET,
    apiVersion: env.NEXT_PUBLIC_SANITY_API_VERSION,
  },
} as const;
