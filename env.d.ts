declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'test' | 'production';
      NEXT_PUBLIC_FIREBASE_API_KEY: string;
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: string;
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: string;
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: string;
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: string;
      NEXT_PUBLIC_FIREBASE_APP_ID: string;
      NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: string;
      NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: string;
      NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID: string;
      LIVEBLOCKS_API_KEY_PROD: string;
      LIVEBLOCKS_API_KEY_DEV: string;
      DISCORD_ID: string;
      GITHUB_TOKEN: string;
      WAKA_TIME_API_KEY: string;
      SPOTIFY_CLIENT_ID: string;
      SPOTIFY_CLIENT_SECRET: string;
      SPOTIFY_REFRESH_TOKEN: string;
      UMAMI_API_KEY: string;
      SENTRY_AUTH_TOKEN: string;
      NEXT_PUBLIC_GCP_PROJECT_ID: string;
      NEXT_PUBLIC_GCP_PRIVATE_KEY_ID: string;
      NEXT_PUBLIC_GCP_PRIVATE_KEY: string;
      NEXT_PUBLIC_GCP_CLIENT_EMAIL: string;
      NEXT_PUBLIC_GCP_CLIENT_ID: string;
      NEXT_PUBLIC_GCP_CLIENT_X509_CERT_URL: string;
    }
  }
}

export {};
