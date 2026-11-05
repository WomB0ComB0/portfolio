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
 * @file Init options for the three Sentry entry points (instrumentation-client.ts,
 * instrumentation-server.ts and instrumentation-edge.ts), as plain functions of the environment.
 *
 * Only Vercel deployments (production and preview) report. Local `next dev` and a local
 * `next build && next start` send nothing, even with a VERCEL_ENV in a local env file, which also
 * keeps dev-only traffic such as Million Lint's local requests out of Sentry. One exception: a
 * file from `vercel env pull` also sets the server marker (VERCEL="1"), so pull only its default
 * 'development' target, because preview or production values would turn server reports on. To
 * debug the integration locally, set SENTRY_ENABLED=1 (server and edge) or
 * NEXT_PUBLIC_SENTRY_ENABLED=1 (browser, needs a production build because the /monitoring tunnel
 * only exists there).
 *
 * `release` is never set here: withSentryConfig injects the release name (SENTRY_RELEASE or the
 * commit SHA, see src/config/sentry-build.ts) for every runtime.
 */

import type { BrowserOptions, ErrorEvent, NodeOptions } from '@sentry/nextjs';

/** @sentry/nextjs doesn't re-export these two types, so they come from the option signatures. */
type TracesSamplerSamplingContext = Parameters<NonNullable<NodeOptions['tracesSampler']>>[0];
type StreamedSpanJSON = Parameters<NonNullable<NodeOptions['beforeSendSpan']>>[0];

/** Bundle key for withSentryConfig's `applicationKey` and the browser's third-party filter. */
export const SENTRY_APPLICATION_KEY = 'mikeodnis-portfolio';

/** Vercel environments that report. `vercel dev` and pulled env files use 'development'. */
const REPORTING_VERCEL_ENVS: ReadonlySet<string> = new Set(['production', 'preview']);

/** Trace share for requests that carry no upstream sampling decision. */
export const TRACE_SAMPLE_RATES = { production: 0.1, other: 0.05 } as const;

/**
 * Share of errored browser sessions that upload a replay (production only). The plan includes
 * 50 replays a month, so no session is recorded without an error.
 */
export const REPLAY_ON_ERROR_SAMPLE_RATE = 0.25;

/**
 * Environment for opt-in reports from outside Vercel, so a local production build is not
 * mistaken for the real 'production'.
 */
export const LOCAL_ENVIRONMENT = 'local';

/** The environment variables the options depend on, read by each entry point. */
export interface SentryRuntimeEnv {
  /**
   * True on a Vercel deployment. The server and edge check VERCEL === '1', which `vercel env pull`
   * also writes (with VERCEL_ENV="development" by default). The browser checks
   * NEXT_PUBLIC_VERCEL_URL, which Vercel inlines into deployment builds only: pulled env files get
   * no NEXT_PUBLIC_VERCEL_* variables.
   */
  onVercel?: boolean;
  /** VERCEL_ENV on the server and edge, NEXT_PUBLIC_VERCEL_ENV in the browser. */
  vercelEnv?: string;
  /** VERCEL_TARGET_ENV: a custom Vercel environment's name, when there is one. */
  vercelTargetEnv?: string;
  /** SENTRY_ENABLED / NEXT_PUBLIC_SENTRY_ENABLED: '1' reports from any environment. */
  optIn?: string;
  /** NODE_ENV: 'development' under `next dev`, 'production' in every build. */
  nodeEnv?: string;
}

/**
 * True on Vercel production and preview deployments, or with the explicit opt-in. Without the
 * opt-in, the dev server is always off, and a local production build stays off without the
 * deployment marker, even when a local env file carries a VERCEL_ENV.
 */
export function isSentryEnabled(env: SentryRuntimeEnv): boolean {
  if (env.optIn === '1') return true;
  if (env.nodeEnv === 'development') return false;
  if (!env.onVercel) return false;
  return REPORTING_VERCEL_ENVS.has(env.vercelEnv ?? '');
}

/**
 * Server and edge environment name: 'production' or 'preview' on Vercel, the value the browser
 * SDK picks by default (NEXT_PUBLIC_VERCEL_TARGET_ENV, then NEXT_PUBLIC_VERCEL_ENV). The older
 * 'vercel-production' and 'vercel-preview' names came from @sentry/nextjs 10, whose server default
 * prefixed VERCEL_ENV with 'vercel-'. Setting the name explicitly keeps it stable across SDK
 * versions and also wins over SENTRY_ENVIRONMENT, which the server and edge SDKs read first.
 */
export function serverEnvironment(env: SentryRuntimeEnv): string {
  return env.vercelTargetEnv || env.vercelEnv || LOCAL_ENVIRONMENT;
}

function traceSampleRate(env: SentryRuntimeEnv): number {
  return env.vercelEnv === 'production' ? TRACE_SAMPLE_RATES.production : TRACE_SAMPLE_RATES.other;
}

/** Uptime checks and the Sentry tunnel are never traced. */
const UNTRACED_PATH =
  /^\/(?:api\/(?:v1\/)?)?(?:health|healthz|ping)(?:[/?]|$)|^\/monitoring(?:[/?]|$)/;

function samplingPath(context: TracesSamplerSamplingContext): string | undefined {
  const attributes = context.attributes ?? {};
  const target = attributes['http.target'] ?? attributes['url.path'];
  if (typeof target === 'string') return target;
  const url = context.normalizedRequest?.url;
  if (url) {
    try {
      return new URL(url, 'http://localhost').pathname;
    } catch {
      // Fall through to the span name.
    }
  }
  // Request spans are named like 'GET /api/health'.
  const space = context.name.indexOf(' ');
  return space > 0 ? context.name.slice(space + 1) : undefined;
}

/**
 * Server and edge sampler: follows the browser's decision for connected traces, drops uptime
 * checks, and otherwise samples at `rate`.
 */
export function createTracesSampler(
  rate: number,
): (context: TracesSamplerSamplingContext) => number {
  return (context) => {
    const path = samplingPath(context);
    if (path && UNTRACED_PATH.test(path)) return 0;
    return context.inheritOrSampleWith(rate);
  };
}

/**
 * Request headers that carry the visitor's IP address or location. Sentry's built-in filter only
 * covers names like auth, token and cookie. These are substring terms, the way
 * `dataCollection.httpHeaders` deny lists match: 'x-vercel-ip-' covers the geo headers
 * (city, country, latitude, ...), and 'forwarded' covers Forwarded, X-Forwarded-For and
 * X-Vercel-Forwarded-For (and X-Forwarded-Host/-Proto, which events don't need).
 */
export const VISITOR_IP_HEADER_TERMS = [
  'forwarded',
  'x-real-ip',
  'x-vercel-proxied-for',
  'x-vercel-ip-',
  'cf-connecting-ip',
  'true-client-ip',
  'x-client-ip',
] as const;

/** Span attributes that hold the visitor's address directly. */
const VISITOR_IP_SPAN_ATTRIBUTES: ReadonlySet<string> = new Set([
  'client.address',
  'http.client_ip',
]);
const REQUEST_HEADER_ATTRIBUTE_PREFIX = 'http.request.header.';

export function isVisitorIpHeader(name: string): boolean {
  const lower = name.toLowerCase();
  return VISITOR_IP_HEADER_TERMS.some((term) => lower.includes(term));
}

function isVisitorIpAttribute(key: string): boolean {
  if (VISITOR_IP_SPAN_ATTRIBUTES.has(key)) return true;
  return (
    key.startsWith(REQUEST_HEADER_ATTRIBUTE_PREFIX) &&
    isVisitorIpHeader(key.slice(REQUEST_HEADER_ATTRIBUTE_PREFIX.length))
  );
}

/** `event` without visitor IP and geo request headers (server and edge `beforeSend`). */
export function stripVisitorIpHeaders<T extends Pick<ErrorEvent, 'request'>>(event: T): T {
  const headers = event.request?.headers;
  if (!headers) return event;
  const names = Object.keys(headers);
  const kept = names.filter((name) => !isVisitorIpHeader(name));
  if (kept.length === names.length) return event;
  return {
    ...event,
    request: {
      ...event.request,
      headers: Object.fromEntries(kept.map((name) => [name, headers[name] as string])),
    },
  };
}

/** `span` without visitor IP attributes (server and edge `beforeSendSpan`). */
export function stripVisitorIpAttributes(span: StreamedSpanJSON): StreamedSpanJSON {
  const entries = Object.entries(span.attributes ?? {});
  const kept = entries.filter(([key]) => !isVisitorIpAttribute(key));
  if (kept.length === entries.length) return span;
  return { ...span, attributes: Object.fromEntries(kept) };
}

/**
 * Browser errors that come from outside the app. Browser-extension frames (Safari masks their
 * URLs as webkit-masked-url://hidden/) and Google Tag Manager's scripts.
 */
export const CLIENT_DENY_URLS: RegExp[] = [
  /^(?:chrome|moz|safari(?:-web)?|ms-browser)-extension:\/\//i,
  /^webkit-masked-url:/i,
  /googletagmanager\.com/i,
];

/**
 * Analytics beacons that content blockers cancel. The SDK appends the host to fetch errors, so
 * these read e.g. "Failed to fetch (www.google-analytics.com)". The SDK already ignores
 * "Script error.", the ResizeObserver loop warning and googletag redefinitions.
 */
export const CLIENT_IGNORE_ERRORS: RegExp[] = [
  /^(?:Failed to fetch|Load failed|NetworkError when attempting to fetch resource\.?) \((?:www\.|region1\.)?(?:google-analytics|analytics\.google|googletagmanager)\.com\)$/,
];

/** What the SDK may collect from visitors in every runtime. */
const BASE_DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  databaseQueryData: false,
  genAI: { inputs: false, outputs: false },
} as const;

export type ClientInitOptions = Pick<
  BrowserOptions,
  | 'enabled'
  | 'environment'
  | 'dataCollection'
  | 'tracesSampleRate'
  | 'replaysSessionSampleRate'
  | 'replaysOnErrorSampleRate'
  | 'denyUrls'
  | 'ignoreErrors'
>;

/**
 * Browser options (without integrations). On Vercel, `environment` is left out so the SDK's
 * default applies; the key must be absent, because the SDK spreads these options over its
 * defaults and an `undefined` value would replace them.
 */
export function buildClientOptions(env: SentryRuntimeEnv): ClientInitOptions {
  return {
    enabled: isSentryEnabled(env),
    ...(env.vercelEnv ? {} : { environment: LOCAL_ENVIRONMENT }),
    dataCollection: { ...BASE_DATA_COLLECTION, httpBodies: [] },
    tracesSampleRate: traceSampleRate(env),
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: env.vercelEnv === 'production' ? REPLAY_ON_ERROR_SAMPLE_RATE : 0,
    denyUrls: [...CLIENT_DENY_URLS],
    ignoreErrors: [...CLIENT_IGNORE_ERRORS],
  };
}

export type ServerInitOptions = Pick<
  NodeOptions,
  | 'enabled'
  | 'environment'
  | 'dataCollection'
  | 'tracesSampler'
  | 'beforeSend'
  | 'beforeSendSpan'
  | 'debug'
>;

/** Node.js and edge options: the same gating, environment, sampling and privacy filters. */
export function buildServerOptions(env: SentryRuntimeEnv): ServerInitOptions {
  return {
    enabled: isSentryEnabled(env),
    environment: serverEnvironment(env),
    dataCollection: {
      ...BASE_DATA_COLLECTION,
      httpBodies: [],
      httpHeaders: { request: { deny: [...VISITOR_IP_HEADER_TERMS] } },
      // Local variables can hold request data such as the client IP.
      stackFrameVariables: false,
    },
    tracesSampler: createTracesSampler(traceSampleRate(env)),
    beforeSend: (event) => stripVisitorIpHeaders(event),
    beforeSendSpan: stripVisitorIpAttributes,
    debug: false,
  };
}
