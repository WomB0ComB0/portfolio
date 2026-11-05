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
// Options live in src/lib/observability/sentry-options.ts. The release (SENTRY_RELEASE or the
// commit SHA) and, on Vercel, the environment come from the SDK's build-time defaults.

import * as Sentry from '@sentry/nextjs';
import { config } from '@/config';
import { buildClientOptions, SENTRY_APPLICATION_KEY } from '@/lib/observability/sentry-options';

Sentry.init({
  dsn: config.sentry.dsn,
  // Literal process.env reads, so Next inlines them into the browser bundle. Vercel inlines
  // NEXT_PUBLIC_VERCEL_URL (the deployment's hostname) into deployment builds only: the browser
  // cannot read VERCEL, and `vercel env pull` writes no NEXT_PUBLIC_VERCEL_* variables.
  ...buildClientOptions({
    onVercel: Boolean(process.env.NEXT_PUBLIC_VERCEL_URL),
    vercelEnv: process.env.NEXT_PUBLIC_VERCEL_ENV,
    optIn: process.env.NEXT_PUBLIC_SENTRY_ENABLED,
    nodeEnv: process.env.NODE_ENV,
  }),
  integrations: [
    // These are the SDK defaults, spelled out because the privacy policy promises them.
    Sentry.replayIntegration({ maskAllText: true, maskAllInputs: true, blockAllMedia: true }),
    Sentry.browserTracingIntegration(),
    Sentry.consoleLoggingIntegration({ levels: ['warn', 'error'] }),
    // Tags errors whose stack has no frame from our bundles (extensions, injected scripts).
    // Once the tag looks right in Sentry, 'drop-error-if-exclusively-contains-third-party-frames'
    // stops them from using quota.
    Sentry.thirdPartyErrorFilterIntegration({
      filterKeys: [SENTRY_APPLICATION_KEY],
      behaviour: 'apply-tag-if-exclusively-contains-third-party-frames',
      ignoreSentryInternalFrames: true,
    }),
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
