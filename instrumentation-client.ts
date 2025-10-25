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

// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import {
  browserTracingIntegration,
  consoleLoggingIntegration,
  init,
  replayIntegration,
} from '@sentry/nextjs';
import * as Sentry from '@sentry/nextjs';
import { config } from '@/config';

if (!config.sentry.dsn) {
  console.warn(
    'Sentry DSN is missing. Please set the NEXT_PUBLIC_SENTRY_DSN environment variable.',
  );
} else {
  // Initialize Sentry
  init({
    dsn: config.sentry.dsn,

    // Add optional integrations for additional features
    integrations: [
      replayIntegration(),
      browserTracingIntegration(),
      consoleLoggingIntegration({ levels: ['log', 'warn', 'error'] }),
    ],
    // Enable logs to be sent to Sentry
    enableLogs: true,
    // Adjust the sample rate for traces in production
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0, // 10% in production, 100% in development

    // Adjust the sample rate for session replays
    replaysSessionSampleRate: process.env.NODE_ENV === 'production' ? 0.01 : 0.1, // 1% in production, 10% in development

    // Capture 100% of replay events when an error occurs
    replaysOnErrorSampleRate: 1.0,

    // Enable debug mode only in development

    // Additional Sentry configuration options
    environment: process.env.NODE_ENV || 'development', // Set the environment
    release: config.app.version, // Link errors to a specific release
  });

  console.log('Sentry initialized successfully.');
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;