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
 * @file The three Sentry entry points pass the right environment variables to the option
 * builders: each is enabled on Vercel deployments and disabled for local runs.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  replayIntegration: vi.fn((options: unknown) => ({ name: 'Replay', options })),
  browserTracingIntegration: vi.fn(() => ({ name: 'BrowserTracing' })),
  consoleLoggingIntegration: vi.fn((options: unknown) => ({ name: 'ConsoleLogs', options })),
  thirdPartyErrorFilterIntegration: vi.fn((options: unknown) => ({
    name: 'ThirdPartyErrorsFilter',
    options,
  })),
  captureRouterTransitionStart: vi.fn(),
}));

vi.mock('@sentry/nextjs', () => sentry);
vi.mock('@/env', () => {
  const env = { NEXT_PUBLIC_SENTRY_DSN: 'https://abc123@o42.ingest.us.sentry.io/7' };
  return { env, default: env };
});
vi.mock('@/config', () => ({
  config: { sentry: { dsn: 'https://abc123@o42.ingest.us.sentry.io/7' } },
}));

const ENTRY_POINTS = {
  client: '../../../instrumentation-client',
  server: '../../../instrumentation-server',
  edge: '../../../instrumentation-edge',
} as const;

/** The options `init` was called with after loading `entry` under the given environment. */
async function initOptionsFor(
  entry: keyof typeof ENTRY_POINTS,
  vars: Record<string, string | undefined>,
): Promise<Record<string, unknown>> {
  for (const [name, value] of Object.entries(vars)) vi.stubEnv(name, value);
  vi.resetModules();
  sentry.init.mockClear();
  await import(ENTRY_POINTS[entry]);
  expect(sentry.init).toHaveBeenCalledTimes(1);
  return sentry.init.mock.calls[0]?.[0] as Record<string, unknown>;
}

const LOCAL = {
  VERCEL_ENV: undefined,
  VERCEL_TARGET_ENV: undefined,
  NEXT_PUBLIC_VERCEL_ENV: undefined,
  SENTRY_ENABLED: undefined,
  NEXT_PUBLIC_SENTRY_ENABLED: undefined,
};

beforeEach(() => {
  for (const [name, value] of Object.entries(LOCAL)) vi.stubEnv(name, value);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe.each(['server', 'edge'] as const)('instrumentation-%s', (entry) => {
  it('is disabled for local runs', async () => {
    const options = await initOptionsFor(entry, {});
    expect(options.enabled).toBe(false);
    expect(options.dsn).toBe('https://abc123@o42.ingest.us.sentry.io/7');
  });

  it('ignores the browser-only variables', async () => {
    const options = await initOptionsFor(entry, {
      NEXT_PUBLIC_VERCEL_ENV: 'production',
      NEXT_PUBLIC_SENTRY_ENABLED: '1',
    });
    expect(options.enabled).toBe(false);
  });

  it('reports from Vercel production as "production"', async () => {
    const options = await initOptionsFor(entry, { VERCEL_ENV: 'production' });
    expect(options).toMatchObject({ enabled: true, environment: 'production' });
    expect(options).not.toHaveProperty('release');
  });

  it('reports from previews as "preview"', async () => {
    const options = await initOptionsFor(entry, { VERCEL_ENV: 'preview' });
    expect(options).toMatchObject({ enabled: true, environment: 'preview' });
  });

  it('can be enabled locally with SENTRY_ENABLED=1', async () => {
    const options = await initOptionsFor(entry, { SENTRY_ENABLED: '1' });
    expect(options).toMatchObject({ enabled: true, environment: 'local' });
  });

  it('stays off under next dev, even with VERCEL_ENV pulled into a local env file', async () => {
    const options = await initOptionsFor(entry, {
      NODE_ENV: 'development',
      VERCEL_ENV: 'production',
    });
    expect(options.enabled).toBe(false);
  });

  it('strips visitor IP headers before sending', async () => {
    const options = await initOptionsFor(entry, { VERCEL_ENV: 'production' });
    const beforeSend = options.beforeSend as (event: unknown, hint: unknown) => unknown;
    expect(
      beforeSend({ request: { headers: { 'x-real-ip': '203.0.113.7', accept: '*/*' } } }, {}),
    ).toEqual({ request: { headers: { accept: '*/*' } } });
  });
});

describe('instrumentation-client', () => {
  it('is disabled for local runs, even when the server-side variables are set', async () => {
    const options = await initOptionsFor('client', {
      VERCEL_ENV: 'production',
      SENTRY_ENABLED: '1',
    });
    expect(options.enabled).toBe(false);
  });

  it('reports from Vercel deployments and leaves environment and release to the SDK', async () => {
    for (const vercelEnv of ['production', 'preview']) {
      const options = await initOptionsFor('client', { NEXT_PUBLIC_VERCEL_ENV: vercelEnv });
      expect(options.enabled, vercelEnv).toBe(true);
      expect(options, vercelEnv).not.toHaveProperty('environment');
      expect(options, vercelEnv).not.toHaveProperty('release');
    }
  });

  it('can be enabled locally with NEXT_PUBLIC_SENTRY_ENABLED=1', async () => {
    const options = await initOptionsFor('client', { NEXT_PUBLIC_SENTRY_ENABLED: '1' });
    expect(options).toMatchObject({ enabled: true, environment: 'local' });
  });

  it('stays off under next dev, even with NEXT_PUBLIC_VERCEL_ENV in a local env file', async () => {
    const options = await initOptionsFor('client', {
      NODE_ENV: 'development',
      NEXT_PUBLIC_VERCEL_ENV: 'production',
    });
    expect(options.enabled).toBe(false);
  });

  it('sends only warnings and errors to Logs, masks replays and tags third-party errors', async () => {
    await initOptionsFor('client', { NEXT_PUBLIC_VERCEL_ENV: 'production' });
    expect(sentry.consoleLoggingIntegration).toHaveBeenLastCalledWith({
      levels: ['warn', 'error'],
    });
    expect(sentry.replayIntegration).toHaveBeenLastCalledWith({
      maskAllText: true,
      maskAllInputs: true,
      blockAllMedia: true,
    });
    expect(sentry.thirdPartyErrorFilterIntegration).toHaveBeenLastCalledWith({
      filterKeys: ['mikeodnis-portfolio'],
      behaviour: 'apply-tag-if-exclusively-contains-third-party-frames',
      ignoreSentryInternalFrames: true,
    });
  });
});
