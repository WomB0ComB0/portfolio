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
import {
  buildClientOptions,
  SENTRY_APPLICATION_KEY,
  withoutSessionTracking,
} from '@/lib/observability/sentry-options';

/** The site's own integrations, added to the SDK's defaults (a same-named default is replaced). */
const siteIntegrations = [
  // These are the SDK defaults, spelled out because the privacy policy promises them. Replay,
  // with the masking the policy describes, is added after init (below).
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
];

Sentry.init({
  // A literal read, which Next inlines, rather than '@/config': that module imports src/env.ts,
  // whose t3-env and zod schemas then loaded ahead of hydration on every page (about 28 KB gzip)
  // only to check variables the build has already validated.
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Literal process.env reads, so Next inlines them into the browser bundle. Vercel inlines
  // NEXT_PUBLIC_VERCEL_URL (the deployment's hostname) into deployment builds only: the browser
  // cannot read VERCEL, and `vercel env pull` writes no NEXT_PUBLIC_VERCEL_* variables.
  ...buildClientOptions({
    onVercel: Boolean(process.env.NEXT_PUBLIC_VERCEL_URL),
    vercelEnv: process.env.NEXT_PUBLIC_VERCEL_ENV,
    optIn: process.env.NEXT_PUBLIC_SENTRY_ENABLED,
    nodeEnv: process.env.NODE_ENV,
  }),
  // The SDK's defaults without per-page-load session tracking (withoutSessionTracking), then the
  // site's own. Errors, traces and replays keep working; only Release Health sessions stop.
  integrations: (defaults) => [...withoutSessionTracking(defaults), ...siteIntegrations],
});

// Session Replay loads in its own chunk once init has run (Sentry's lazy-loading pattern), so its
// ~38 KB no longer sits in the JavaScript every page runs before hydration. The import starts
// right away, so Replay begins buffering as soon as the chunk arrives; an error thrown before then
// is still reported, just without a replay. Sample rates still come from the init options above.
// Where the SDK is disabled (local builds) nothing is fetched, as Replay was never set up there.
if (Sentry.isEnabled()) {
  import('@/lib/observability/sentry-replay')
    .then(({ replayIntegration }) => {
      Sentry.addIntegration(
        replayIntegration({ maskAllText: true, maskAllInputs: true, blockAllMedia: true }),
      );
    })
    .catch(() => {
      // The chunk did not load (offline, or a deploy replaced it): this visit has no Replay, as
      // with a content blocker. Errors still report; the failed load is not itself an error in
      // the page, so it is not reported as an unhandled rejection.
    });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
