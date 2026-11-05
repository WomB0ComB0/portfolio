// @vitest-environment node
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
 * @file withSentryConfig options: every production build is wrapped (the CSP depends on the
 * /monitoring tunnel), while uploads and releases need both the token and a release build.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildSentryBuildOptions,
  canPublishToSentry,
  shouldApplySentryConfig,
} from '@/config/sentry-build';
import { SENTRY_APPLICATION_KEY } from '@/lib/observability/sentry-options';

const sentryConfig = vi.hoisted(() => ({
  withSentryConfig: vi.fn((config: object, options: object) => ({
    ...config,
    sentryOptions: options,
  })),
}));

vi.mock('@sentry/nextjs/config', () => sentryConfig);
vi.mock('../../../src/env', () => ({ env: {}, default: {} }));
// Like @million/lint 1.0.14: under Turbopack it adds its loader rules at experimental.turbo.
vi.mock('@million/lint', () => ({
  default: {
    next: () => (config: { experimental?: Record<string, unknown> }) =>
      process.env.TURBOPACK
        ? { ...config, experimental: { ...config.experimental, turbo: { rules: {} } } }
        : config,
  },
}));
vi.mock('@next/bundle-analyzer', () => ({ default: () => (config: unknown) => config }));

const VERCEL_PRODUCTION = {
  NODE_ENV: 'production',
  CI: '1',
  VERCEL: '1',
  VERCEL_ENV: 'production',
  VERCEL_TARGET_ENV: 'production',
  VERCEL_GIT_COMMIT_SHA: 'a1b2c3d4',
  SENTRY_AUTH_TOKEN: 'test-token',
};
const VERCEL_PREVIEW = {
  ...VERCEL_PRODUCTION,
  VERCEL_ENV: 'preview',
  VERCEL_TARGET_ENV: 'preview',
};
const LOCAL_BUILD = { NODE_ENV: 'production', SENTRY_AUTH_TOKEN: 'test-token' };

describe('shouldApplySentryConfig', () => {
  it('wraps every production build, with or without a token', () => {
    expect(shouldApplySentryConfig({ NODE_ENV: 'production' })).toBe(true);
    expect(shouldApplySentryConfig(VERCEL_PRODUCTION)).toBe(true);
    expect(shouldApplySentryConfig({ NODE_ENV: 'development' })).toBe(false);
  });
});

describe('canPublishToSentry', () => {
  it('needs a release build (Vercel or SENTRY_RELEASE) and the token', () => {
    expect(canPublishToSentry(VERCEL_PRODUCTION)).toBe(true);
    expect(canPublishToSentry(VERCEL_PREVIEW)).toBe(true);
    expect(canPublishToSentry({ SENTRY_RELEASE: 'v1', SENTRY_AUTH_TOKEN: 't' })).toBe(true);
    expect(canPublishToSentry({ ...VERCEL_PRODUCTION, SENTRY_AUTH_TOKEN: undefined })).toBe(false);
    expect(canPublishToSentry(LOCAL_BUILD)).toBe(false);
  });
});

describe('buildSentryBuildOptions', () => {
  it('uploads source maps and creates the release on Vercel builds with a token', () => {
    const options = buildSentryBuildOptions(VERCEL_PRODUCTION);
    expect(options.sourcemaps?.disable).toBe(false);
    expect(options.release?.create).toBe(true);
    expect(options.release?.name).toBe('a1b2c3d4');
  });

  it("names the release in the SDK's default order: SENTRY_RELEASE, then the commit SHA", () => {
    // The build injects this name into every runtime, so events and the release agree.
    expect(
      buildSentryBuildOptions({ ...VERCEL_PRODUCTION, SENTRY_RELEASE: 'v4.2.0' }).release?.name,
    ).toBe('v4.2.0');
    expect(buildSentryBuildOptions({ SENTRY_RELEASE: 'v4.2.0' }).release?.name).toBe('v4.2.0');
    expect(
      buildSentryBuildOptions({ ...VERCEL_PRODUCTION, SENTRY_RELEASE: '' }).release?.name,
    ).toBe('a1b2c3d4');
    expect(buildSentryBuildOptions(LOCAL_BUILD, 42).release?.name).toBe('local-42');
  });

  it("sends no build telemetry to Sentry's own project", () => {
    expect(buildSentryBuildOptions(VERCEL_PRODUCTION).telemetry).toBe(false);
    expect(buildSentryBuildOptions(LOCAL_BUILD).telemetry).toBe(false);
  });

  it('keeps the tunnel but skips uploads and release changes without a token', () => {
    const options = buildSentryBuildOptions({ ...VERCEL_PRODUCTION, SENTRY_AUTH_TOKEN: undefined });
    expect(options.tunnelRoute).toBe('/monitoring');
    expect(options.sourcemaps?.disable).toBe('disable-upload');
    expect(options.release).toMatchObject({ create: false, finalize: false, setCommits: false });
  });

  it('leaves the project alone on local builds, even with the token', () => {
    const options = buildSentryBuildOptions(LOCAL_BUILD, 1_700_000_000_000);
    expect(options.release).toEqual({
      name: 'local-1700000000000',
      create: false,
      finalize: false,
      setCommits: false,
    });
    expect(options.sourcemaps?.disable).toBe('disable-upload');
  });

  it("uses the plugin's commit association on production and none on previews", () => {
    expect(buildSentryBuildOptions(VERCEL_PRODUCTION).release).not.toHaveProperty('setCommits');
    expect(buildSentryBuildOptions(VERCEL_PREVIEW).release?.setCommits).toBe(false);
  });

  it('is silent only outside CI, so Vercel build logs show upload problems', () => {
    expect(buildSentryBuildOptions(VERCEL_PRODUCTION).silent).toBe(false);
    expect(buildSentryBuildOptions(LOCAL_BUILD).silent).toBe(true);
  });

  it("keeps the SDK's default source-map globs and the replay compression worker", () => {
    const options = buildSentryBuildOptions(VERCEL_PRODUCTION);
    expect(options.sourcemaps).not.toHaveProperty('assets');
    expect(options.sourcemaps).not.toHaveProperty('ignore');
    expect(options.sourcemaps?.deleteSourcemapsAfterUpload).toBe(true);
    expect(options.bundleSizeOptimizations).not.toHaveProperty('excludeReplayWorker');
  });

  it('marks first-party bundles with the key the browser filter uses', () => {
    expect(buildSentryBuildOptions(VERCEL_PRODUCTION).applicationKey).toBe(SENTRY_APPLICATION_KEY);
  });
});

describe('next.config.ts', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    sentryConfig.withSentryConfig.mockClear();
  });

  const loadConfig = async (vars: Record<string, string | undefined>) => {
    for (const [name, value] of Object.entries(vars)) vi.stubEnv(name, value);
    vi.resetModules();
    // The optional optimisation lists may be missing here; that warning isn't under test.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      return (await import('../../../next.config')).default as Record<string, unknown>;
    } finally {
      warn.mockRestore();
    }
  };

  it('wraps a production build that has no auth token', async () => {
    const config = await loadConfig({
      NODE_ENV: 'production',
      VERCEL: '1',
      SENTRY_AUTH_TOKEN: undefined,
      SENTRY_RELEASE: undefined,
    });
    expect(sentryConfig.withSentryConfig).toHaveBeenCalledTimes(1);
    expect(config.sentryOptions).toMatchObject({
      tunnelRoute: '/monitoring',
      sourcemaps: { disable: 'disable-upload' },
    });
  });

  it('does not wrap the dev server config', async () => {
    await loadConfig({ NODE_ENV: 'development' });
    expect(sentryConfig.withSentryConfig).not.toHaveBeenCalled();
  });

  it('has no webpack devtool override', async () => {
    const config = await loadConfig({ NODE_ENV: 'production' });
    const webpack = config.webpack as (c: unknown, o: unknown) => Record<string, unknown>;
    const result = webpack(
      { resolve: {}, module: { rules: [] }, devtool: 'hidden-source-map' },
      { isServer: true },
    );
    expect(result.devtool).toBe('hidden-source-map');
  });

  it('drops the experimental.turbo key Million Lint adds, which Next 16 rejects', async () => {
    const config = await loadConfig({ NODE_ENV: 'production', TURBOPACK: '1' });
    const experimental = config.experimental as Record<string, unknown>;
    expect(experimental).not.toHaveProperty('turbo');
    expect(experimental).toMatchObject({ optimizeCss: true, authInterrupts: true });
  });
});
