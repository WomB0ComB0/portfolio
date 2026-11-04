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
 * @file The Sentry init options: only Vercel deployments report, server and edge use the same
 * environment names as the browser, visitor IP headers never leave the server, and the browser
 * drops known third-party noise.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  buildClientOptions,
  buildServerOptions,
  CLIENT_DENY_URLS,
  CLIENT_IGNORE_ERRORS,
  createTracesSampler,
  isSentryEnabled,
  LOCAL_ENVIRONMENT,
  REPLAY_ON_ERROR_SAMPLE_RATE,
  serverEnvironment,
  stripVisitorIpAttributes,
  stripVisitorIpHeaders,
  TRACE_SAMPLE_RATES,
  VISITOR_IP_HEADER_TERMS,
} from '@/lib/observability/sentry-options';

type SamplerContext = Parameters<ReturnType<typeof createTracesSampler>>[0];
type Span = Parameters<typeof stripVisitorIpAttributes>[0];

describe('isSentryEnabled', () => {
  it('reports from Vercel production and preview deployments', () => {
    expect(isSentryEnabled({ vercelEnv: 'production' })).toBe(true);
    expect(isSentryEnabled({ vercelEnv: 'preview' })).toBe(true);
  });

  it('sends nothing from local runs (next dev, next start, vercel dev)', () => {
    expect(isSentryEnabled({})).toBe(false);
    expect(isSentryEnabled({ vercelEnv: '' })).toBe(false);
    expect(isSentryEnabled({ vercelEnv: 'development' })).toBe(false);
  });

  it('can be switched on locally with an explicit opt-in', () => {
    expect(isSentryEnabled({ optIn: '1' })).toBe(true);
    expect(isSentryEnabled({ optIn: 'true' })).toBe(false);
    expect(isSentryEnabled({ optIn: '0', vercelEnv: 'development' })).toBe(false);
    expect(isSentryEnabled({ optIn: '1', nodeEnv: 'development' })).toBe(true);
  });

  it('keeps the dev server off even with a VERCEL_ENV pulled into a local env file', () => {
    expect(isSentryEnabled({ vercelEnv: 'production', nodeEnv: 'development' })).toBe(false);
    expect(isSentryEnabled({ vercelEnv: 'preview', nodeEnv: 'development' })).toBe(false);
    expect(isSentryEnabled({ vercelEnv: 'production', nodeEnv: 'production' })).toBe(true);
  });
});

describe('serverEnvironment', () => {
  it("uses Vercel's environment name, never a 'vercel-' prefixed one", () => {
    expect(serverEnvironment({ vercelEnv: 'production' })).toBe('production');
    expect(serverEnvironment({ vercelEnv: 'preview' })).toBe('preview');
    expect(serverEnvironment({ vercelEnv: 'preview', vercelTargetEnv: 'staging' })).toBe('staging');
  });

  it('labels opt-in reports from outside Vercel as local', () => {
    expect(serverEnvironment({ optIn: '1' })).toBe(LOCAL_ENVIRONMENT);
  });
});

describe('buildClientOptions', () => {
  it('is disabled locally and enabled on Vercel', () => {
    expect(buildClientOptions({}).enabled).toBe(false);
    expect(buildClientOptions({ vercelEnv: 'production' }).enabled).toBe(true);
    expect(buildClientOptions({ vercelEnv: 'preview' }).enabled).toBe(true);
    expect(buildClientOptions({ optIn: '1' }).enabled).toBe(true);
  });

  it('leaves environment to the SDK default on Vercel (the key must be absent)', () => {
    expect('environment' in buildClientOptions({ vercelEnv: 'production' })).toBe(false);
    expect('environment' in buildClientOptions({ vercelEnv: 'preview' })).toBe(false);
    expect(buildClientOptions({ optIn: '1' }).environment).toBe(LOCAL_ENVIRONMENT);
  });

  it('never sets a release (the build injects the commit SHA)', () => {
    expect('release' in buildClientOptions({ vercelEnv: 'production' })).toBe(false);
    expect('release' in buildServerOptions({ vercelEnv: 'production' })).toBe(false);
  });

  it('records no session without an error, and only production spends replays', () => {
    const production = buildClientOptions({ vercelEnv: 'production' });
    expect(production.replaysSessionSampleRate).toBe(0);
    expect(production.replaysOnErrorSampleRate).toBe(REPLAY_ON_ERROR_SAMPLE_RATE);
    expect(REPLAY_ON_ERROR_SAMPLE_RATE).toBeLessThan(1);

    const preview = buildClientOptions({ vercelEnv: 'preview' });
    expect(preview.replaysSessionSampleRate).toBe(0);
    expect(preview.replaysOnErrorSampleRate).toBe(0);
  });

  it('samples traces at a low rate', () => {
    expect(buildClientOptions({ vercelEnv: 'production' }).tracesSampleRate).toBe(
      TRACE_SAMPLE_RATES.production,
    );
    expect(buildClientOptions({ vercelEnv: 'preview' }).tracesSampleRate).toBe(
      TRACE_SAMPLE_RATES.other,
    );
    expect(TRACE_SAMPLE_RATES.production).toBeLessThanOrEqual(0.1);
  });

  it('collects no user info, cookies or bodies', () => {
    expect(buildClientOptions({ vercelEnv: 'production' }).dataCollection).toMatchObject({
      userInfo: false,
      cookies: false,
      httpBodies: [],
    });
  });
});

describe('browser noise filters', () => {
  const denied = (url: string) => CLIENT_DENY_URLS.some((pattern) => pattern.test(url));
  const ignored = (message: string) =>
    CLIENT_IGNORE_ERRORS.some((pattern) => pattern.test(message));

  it('drops errors thrown by browser extensions and Google Tag Manager', () => {
    for (const url of [
      'chrome-extension://abcdefghijklmnop/content.js',
      'moz-extension://1234-5678/inject.js',
      'safari-extension://com.example.ext/script.js',
      'safari-web-extension://ABCD/script.js',
      'webkit-masked-url://hidden/',
      'https://www.googletagmanager.com/gtag/js?id=G-TEST',
    ]) {
      expect(denied(url), url).toBe(true);
    }
  });

  it("keeps the site's own scripts and Google Maps", () => {
    for (const url of [
      'https://mikeodnis.dev/_next/static/chunks/app.js',
      'https://maps.googleapis.com/maps/api/js',
    ]) {
      expect(denied(url), url).toBe(false);
    }
  });

  it('ignores analytics beacons blocked by content blockers', () => {
    expect(ignored('Failed to fetch (www.google-analytics.com)')).toBe(true);
    expect(ignored('Load failed (region1.google-analytics.com)')).toBe(true);
    expect(ignored('NetworkError when attempting to fetch resource. (analytics.google.com)')).toBe(
      true,
    );
    expect(ignored('Failed to fetch (www.googletagmanager.com)')).toBe(true);
  });

  it('keeps failed requests to the site itself', () => {
    expect(ignored('Failed to fetch (mikeodnis.dev)')).toBe(false);
    expect(ignored('Failed to fetch')).toBe(false);
  });
});

describe('buildServerOptions', () => {
  it('is disabled locally and enabled on Vercel, for Node.js and edge alike', () => {
    expect(buildServerOptions({}).enabled).toBe(false);
    expect(buildServerOptions({ vercelEnv: 'development' }).enabled).toBe(false);
    expect(buildServerOptions({ vercelEnv: 'production' }).enabled).toBe(true);
    expect(buildServerOptions({ vercelEnv: 'preview' }).enabled).toBe(true);
    expect(buildServerOptions({ optIn: '1' }).enabled).toBe(true);
  });

  it('sets the environment explicitly, so SENTRY_ENVIRONMENT cannot rename it', () => {
    expect(buildServerOptions({ vercelEnv: 'production' }).environment).toBe('production');
    expect(buildServerOptions({ vercelEnv: 'preview' }).environment).toBe('preview');
  });

  it('denies visitor IP headers and local variables in collected data', () => {
    const { dataCollection } = buildServerOptions({ vercelEnv: 'production' });
    expect(dataCollection).toMatchObject({
      userInfo: false,
      cookies: false,
      httpBodies: [],
      stackFrameVariables: false,
      httpHeaders: { request: { deny: [...VISITOR_IP_HEADER_TERMS] } },
    });
  });

  it('wires the header and span filters', () => {
    const options = buildServerOptions({ vercelEnv: 'production' });
    const event = {
      request: { headers: { 'x-forwarded-for': '203.0.113.7', 'user-agent': 'test' } },
    };
    const filtered = options.beforeSend?.(event as never, {});
    expect(filtered).toEqual({ request: { headers: { 'user-agent': 'test' } } });
    expect(options.beforeSendSpan).toBe(stripVisitorIpAttributes);
  });
});

describe('stripVisitorIpHeaders', () => {
  const visitorHeaders = {
    'x-forwarded-for': '203.0.113.7, 10.0.0.1',
    'X-Real-IP': '203.0.113.7',
    'x-vercel-forwarded-for': '203.0.113.7',
    'x-vercel-proxied-for': '203.0.113.7',
    'x-vercel-ip-city': 'Brooklyn',
    'x-vercel-ip-country': 'US',
    'x-vercel-ip-latitude': '40.6',
    'x-vercel-ip-longitude': '-73.9',
    'cf-connecting-ip': '203.0.113.7',
    'true-client-ip': '203.0.113.7',
    forwarded: 'for=203.0.113.7',
  };
  const keptHeaders = {
    'user-agent': 'Mozilla/5.0',
    referer: 'https://mikeodnis.dev/',
    accept: 'text/html',
    'accept-language': 'en-US',
  };

  it('removes IP and geo headers and keeps the rest', () => {
    const event = {
      event_id: 'abc',
      request: {
        url: 'https://mikeodnis.dev/api/v1/blog',
        headers: { ...visitorHeaders, ...keptHeaders },
      },
    };
    const result = stripVisitorIpHeaders(event);
    expect(result.request?.headers).toEqual(keptHeaders);
    expect(result.request?.url).toBe('https://mikeodnis.dev/api/v1/blog');
    expect(result.event_id).toBe('abc');
  });

  it('does not modify the original event', () => {
    const event = { request: { headers: { ...visitorHeaders, ...keptHeaders } } };
    stripVisitorIpHeaders(event);
    expect(Object.keys(event.request.headers)).toHaveLength(
      Object.keys(visitorHeaders).length + Object.keys(keptHeaders).length,
    );
  });

  it('returns events without visitor headers unchanged', () => {
    const noRequest = { message: 'hi', request: undefined };
    expect(stripVisitorIpHeaders(noRequest)).toBe(noRequest);
    const noHeaders = { request: { url: 'https://mikeodnis.dev/' } };
    expect(stripVisitorIpHeaders(noHeaders)).toBe(noHeaders);
    const clean = { request: { headers: { ...keptHeaders } } };
    expect(stripVisitorIpHeaders(clean)).toBe(clean);
  });
});

describe('stripVisitorIpAttributes', () => {
  const span = (attributes: Record<string, unknown>): Span => ({
    trace_id: 't',
    span_id: 's',
    name: 'GET /api/v1/blog',
    start_timestamp: 0,
    status: 'ok',
    is_segment: true,
    attributes,
  });

  it('removes the client address and IP header attributes', () => {
    const result = stripVisitorIpAttributes(
      span({
        'client.address': '203.0.113.7',
        'http.request.header.x-forwarded-for': ['203.0.113.7'],
        'http.request.header.x-vercel-ip-city': ['Brooklyn'],
        'http.request.header.user-agent': ['Mozilla/5.0'],
        'http.request.method': 'GET',
      }),
    );
    expect(result.attributes).toEqual({
      'http.request.header.user-agent': ['Mozilla/5.0'],
      'http.request.method': 'GET',
    });
  });

  it('returns spans without such attributes unchanged', () => {
    const clean = span({ 'http.request.method': 'GET' });
    expect(stripVisitorIpAttributes(clean)).toBe(clean);
  });
});

describe('createTracesSampler', () => {
  const context = (overrides: Partial<SamplerContext>): SamplerContext =>
    ({
      name: 'GET /api/v1/blog',
      attributes: {},
      inheritOrSampleWith: vi.fn((fallback: number) => fallback),
      ...overrides,
    }) as SamplerContext;

  it('follows the incoming decision, falling back to the given rate', () => {
    const sampler = createTracesSampler(0.1);
    const ctx = context({});
    expect(sampler(ctx)).toBe(0.1);
    expect(ctx.inheritOrSampleWith).toHaveBeenCalledWith(0.1);
  });

  it('never traces uptime checks or the Sentry tunnel', () => {
    const sampler = createTracesSampler(1);
    expect(sampler(context({ name: 'GET /api/health' }))).toBe(0);
    expect(sampler(context({ name: 'GET /healthz' }))).toBe(0);
    expect(
      sampler(
        context({ name: 'GET /api/[[...route]]', attributes: { 'http.target': '/api/health' } }),
      ),
    ).toBe(0);
    expect(
      sampler(
        context({
          name: 'POST',
          normalizedRequest: { url: 'https://mikeodnis.dev/monitoring?o=1' },
        }),
      ),
    ).toBe(0);
    expect(sampler(context({ name: 'GET /api/healthy-recipes' }))).toBe(1);
  });

  it('gives the server and edge a low production rate and a lower preview rate', () => {
    const production = buildServerOptions({ vercelEnv: 'production' }).tracesSampler;
    const preview = buildServerOptions({ vercelEnv: 'preview' }).tracesSampler;
    expect(production?.(context({}))).toBe(TRACE_SAMPLE_RATES.production);
    expect(preview?.(context({}))).toBe(TRACE_SAMPLE_RATES.other);
    expect(TRACE_SAMPLE_RATES.other).toBeLessThan(TRACE_SAMPLE_RATES.production);
  });
});
