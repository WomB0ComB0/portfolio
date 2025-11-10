/**
 * Copyright 2025 Mike Odnis
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
      NEXT_PUBLIC_DISCORD_ID: string;
      REACT_EDITOR: string;
      NEXT_PUBLIC_HASHNODE_TOKEN: string;
      GITHUB_TOKEN: string;
      WAKA_TIME_API_KEY: string;
      SPOTIFY_CLIENT_ID: string;
      SPOTIFY_CLIENT_SECRET: string;
      SPOTIFY_REFRESH_TOKEN: string;
      NEXT_PUBLIC_SENTRY_DSN: string;
      SENTRY_AUTH_TOKEN: string;
      NEXT_PUBLIC_GCP_PROJECT_ID: string;
      NEXT_PUBLIC_GCP_PRIVATE_KEY_ID: string;
      NEXT_PUBLIC_GCP_PRIVATE_KEY: string;
      NEXT_PUBLIC_GCP_CLIENT_EMAIL: string;
      NEXT_PUBLIC_GCP_CLIENT_ID: string;
      NEXT_PUBLIC_GCP_CLIENT_X509_CERT_URL: string;
      NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY: string;
      VERCEL_GIT_COMMIT_SHA?: string;
      NEXT_PUBLIC_UPSTASH_REDIS_REST_URL: string;
      NEXT_PUBLIC_UPSTASH_REDIS_REST_TOKEN: string;
      CSRF_SECRET: string;
      ADMIN_API_TOKEN: string;
      NEXT_PUBLIC_SANITY_PROJECT_ID: string;
      NEXT_PUBLIC_SANITY_DATASET: string;
      NEXT_PUBLIC_SANITY_API_VERSION: string;
      SANITY_API_TOKEN: string;
    }
  }
}

export {};
