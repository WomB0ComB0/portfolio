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

/**
 * @file withSentryConfig options for next.config.ts, as a function of the build environment.
 *
 * Every production build is wrapped: the wrapper also adds the /monitoring tunnel, which the
 * enforced CSP relies on (connect-src has no Sentry host), and injects the release and debug IDs.
 * Only uploads and release management depend on the auth token.
 */

import type { SentryBuildOptions } from '@sentry/nextjs/config';
import { SENTRY_APPLICATION_KEY } from '../lib/observability/sentry-options';

/** The build-time environment variables these options read. */
export interface SentryBuildEnv {
  NODE_ENV?: string;
  CI?: string;
  VERCEL?: string;
  VERCEL_TARGET_ENV?: string;
  VERCEL_ENV?: string;
  VERCEL_GIT_COMMIT_SHA?: string;
  SENTRY_RELEASE?: string;
  SENTRY_AUTH_TOKEN?: string;
  SENTRY_ORG?: string;
  SENTRY_PROJECT?: string;
}

/** `next build` wraps the config; `next dev` does not (it never reports). */
export function shouldApplySentryConfig(env: SentryBuildEnv): boolean {
  return env.NODE_ENV === 'production';
}

/**
 * Only Vercel builds (or a build given an explicit SENTRY_RELEASE) create Sentry releases and
 * upload source maps. Otherwise every local `next build` with the real env files would add a
 * `local-<timestamp>` release to the project. Both also need the auth token.
 */
export function canPublishToSentry(env: SentryBuildEnv): boolean {
  const isReleaseBuild = env.VERCEL === '1' || Boolean(env.SENTRY_RELEASE);
  return isReleaseBuild && Boolean(env.SENTRY_AUTH_TOKEN);
}

/**
 * Commits are associated on Vercel production builds only. Left undefined there, the plugin uses
 * its Vercel default (this commit and the previous production SHA). Previews skip it: their
 * "previous commit" is the branch point, which floods Sentry with unrelated commits.
 */
function setCommitsFor(env: SentryBuildEnv): false | undefined {
  if (env.VERCEL !== '1') return undefined;
  const target = env.VERCEL_TARGET_ENV || env.VERCEL_ENV;
  return target === 'production' ? undefined : false;
}

export function buildSentryBuildOptions(
  env: SentryBuildEnv,
  now: number = Date.now(),
): SentryBuildOptions {
  const publish = canPublishToSentry(env);
  const setCommits = setCommitsFor(env);

  return {
    org: env.SENTRY_ORG || 'womb0comb0',
    project: env.SENTRY_PROJECT || 'portfolio',
    authToken: env.SENTRY_AUTH_TOKEN,
    // Sentry's documented default: build logs (Vercel sets CI=1) show upload and auth failures.
    silent: !env.CI,
    // Marks first-party browser bundles for thirdPartyErrorFilterIntegration.
    applicationKey: SENTRY_APPLICATION_KEY,
    // The plugin otherwise reports usage data from every build to Sentry's own project.
    telemetry: false,

    release: {
      // SENTRY_RELEASE first, as in the SDK's own default (getSentryRelease). withSentryConfig
      // injects this name into every runtime, so events carry the release the build creates;
      // src/proxy.ts tags CSP reports in the same order.
      name: env.SENTRY_RELEASE || env.VERCEL_GIT_COMMIT_SHA || `local-${now}`,
      create: publish,
      // Without publishing, the release stays untouched: no finalize, no commits.
      ...(publish ? {} : { finalize: false }),
      ...(publish && setCommits === undefined ? {} : { setCommits: false as const }),
    },

    // No custom `assets`: the SDK's Turbopack defaults cover .next/server and .next/static.
    sourcemaps: {
      disable: publish ? false : 'disable-upload',
      deleteSourcemapsAfterUpload: true,
    },

    widenClientFileUpload: true,
    tunnelRoute: '/monitoring',

    bundleSizeOptimizations: {
      excludeDebugStatements: true,
      excludeReplayShadowDom: true,
      excludeReplayIframe: true,
      // The replay compression worker stays: without a hosted `workerUrl`, excluding it makes
      // replays upload uncompressed. It loads from a blob: URL, which worker-src allows.
    },
  };
}
