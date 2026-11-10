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
 * @file Error reporting for code that handles its own errors (handled errors never reach Next's
 * onRequestError hook). A plain module on purpose: no 'use server' or 'use client' directive.
 *
 * Every helper reports a given error once. An error that was already sent, or one that wraps it
 * through `cause`, is skipped, so a route's own handler and the API's root handler never both
 * report the same failure.
 */

import * as Sentry from '@sentry/nextjs';
import type { SignInMethod } from '@/core/auth.types';

type CaptureContext = Parameters<typeof Sentry.captureException>[1];

/** Errors already sent to Sentry. */
const reported = new WeakSet<object>();
/** How far `cause` chains are followed. */
const MAX_CAUSE_DEPTH = 5;

function causeChain(error: unknown): object[] {
  const chain: object[] = [];
  let current: unknown = error;
  while (chain.length < MAX_CAUSE_DEPTH && typeof current === 'object' && current !== null) {
    chain.push(current);
    current = (current as { cause?: unknown }).cause;
  }
  return chain;
}

/** True when `error`, or an error in its `cause` chain, was already reported. */
export function wasReported(error: unknown): boolean {
  return causeChain(error).some((link) => reported.has(link));
}

function markReported(error: unknown): void {
  for (const link of causeChain(error)) reported.add(link);
}

/** Sends `error` to Sentry unless it (or its cause) was already sent. */
export function reportError(error: unknown, context?: CaptureContext): boolean {
  if (wasReported(error)) return false;
  markReported(error);
  Sentry.captureException(error, context);
  return true;
}

/** Each API context reports at most once per window and level, per instance. */
export const API_REPORT_COOLDOWN_MS = 5 * 60_000;
const lastApiReportAt = new Map<string, number>();

type ApiReportLevel = 'error' | 'warning';

export interface ApiFailureReport {
  /** The handler's context, e.g. 'fetch system status'. Tags and groups the issue. */
  context: string;
  /** 'warning' when the route still answers with fallback data. */
  level?: ApiReportLevel;
  /**
   * false sends the report whatever the context's cooldown, and neither checks nor starts it. For
   * callers that already report each failure once (e.g. one warning per decoded Sanity answer),
   * where a throttled report would be lost for good.
   */
  cooldown?: boolean;
  now?: number;
}

/**
 * Cooldowns are kept per context and level: a stale-fallback warning sent when an outage starts
 * must not silence the error the same route sends once its fallback runs out.
 */
const cooldownKey = (context: string, level: ApiReportLevel): string => `${level}:${context}`;

/**
 * Reports a failure a route handled itself (createErrorHandler). Issues are grouped by context
 * first (then by Sentry's default grouping within it), so a context's warnings and errors share
 * an issue. Each context sends at most one event per level per {@link API_REPORT_COOLDOWN_MS}, so
 * an upstream outage that every request runs into costs one event per window instead of one per
 * request (unless `cooldown` is false).
 */
export function reportApiFailure(
  error: unknown,
  { context, level = 'error', cooldown = true, now = Date.now() }: ApiFailureReport,
): boolean {
  if (wasReported(error)) return false;
  markReported(error);
  if (cooldown) {
    const key = cooldownKey(context, level);
    const last = lastApiReportAt.get(key);
    if (last !== undefined && now - last < API_REPORT_COOLDOWN_MS) return false;
    lastApiReportAt.set(key, now);
  }
  Sentry.captureException(error, {
    level,
    tags: { 'api.context': context },
    fingerprint: ['api', context, '{{ default }}'],
  });
  return true;
}

/** A failed sign-in as reportSignInFailure logs it: nothing that says who the visitor is. */
export interface SignInFailure {
  /** Firebase's error code, e.g. 'auth/popup-closed-by-user', or 'unknown'. */
  readonly code: string;
  /** The provider pressed: 'google.com', 'github.com' or 'anonymous'. */
  readonly method: SignInMethod;
  /** From the press to the failure, in ms. */
  readonly elapsedMs: number;
}

/**
 * Logs a failed sign-in to Sentry Logs at warn level. The browser's own console logging is off in
 * production, and a breadcrumb would travel only with a later error. Only the code, the provider
 * and the timing are sent: never the error's message or customData (which can hold an email), a
 * name or a uid.
 *
 * Firebase raises 'auth/popup-closed-by-user' only from its 8 s timer, started when it finds the
 * popup's tab closed (it checks every 2 s). So for that code elapsedMs is the time the tab was open
 * plus 8-10 s, whatever closed it: on its own it cannot tell a visitor who gave up from a sign-in
 * that was still finishing. reportSignInAfterClosedPopup records the second case.
 */
export function reportSignInFailure({ code, method, elapsedMs }: SignInFailure): void {
  Sentry.logger.warn('Sign-in failed', { code, method, elapsedMs });
}

/** A user Firebase reported soon after a closed popup, as reportSignInAfterClosedPopup logs it. */
export interface SignInAfterClosedPopup {
  /** The provider whose popup Firebase reported closed. */
  readonly method: SignInMethod;
  /** From that error to Firebase reporting a user, in ms. */
  readonly gapMs: number;
  /**
   * Whether a newer sign-in was under way (the store's phase was 'signing-in') when Firebase
   * reported the user: a provider's popup, or a guest sign-in, which opens no popup.
   */
  readonly signingIn: boolean;
}

/**
 * Logs, at info level, that Firebase reported a user soon after it said a popup closed. With no
 * sign-in under way, Firebase finished the closed popup on its own (or another tab signed in): the
 * closed error came while sign-in was still finishing. With one under way the visitor had pressed
 * again, so either sign-in may have done it. Only the provider, the gap and that flag are sent.
 */
export function reportSignInAfterClosedPopup({
  method,
  gapMs,
  signingIn,
}: SignInAfterClosedPopup): void {
  Sentry.logger.info('Signed in after a closed-popup error', { method, gapMs, signingIn });
}

/** Forgets the per-context, per-level cooldowns. Tests only. */
export function resetApiReportCooldowns(): void {
  lastApiReportAt.clear();
}

/** 'GET /api/v1/blog': the request's real path, not the catch-all route file. */
export function apiTransactionName(request: Request): string {
  try {
    return `${request.method} ${new URL(request.url).pathname}`;
  } catch {
    return request.method;
  }
}

/**
 * Names the request's events after its real path. All API traffic goes through the catch-all
 * route files, so without this every API issue shows the same transaction.
 */
export function nameApiTransaction(request: Request): void {
  Sentry.getIsolationScope().setTransactionName(apiTransactionName(request));
}

/**
 * True for API errors that are the server's fault. Not-found routes, malformed bodies, invalid
 * requests and numeric 4xx codes are the client's, so they are not reported. A VALIDATION error
 * on the response (a handler breaking its own schema) is a server bug.
 */
export function isServerSideApiError(code: unknown, error: unknown): boolean {
  if (code === 'NOT_FOUND' || code === 'PARSE') return false;
  if (code === 'VALIDATION') return (error as { type?: unknown } | null)?.type === 'response';
  return !(typeof code === 'number' && code < 500);
}

export interface ApiServerErrorReport {
  /** Elysia's error code, e.g. 'UNKNOWN' or 'VALIDATION'. */
  code?: unknown;
  request?: Request;
}

/** Reports an error that the API answered with a 500, unless a route already reported it. */
export function reportApiServerError(
  error: unknown,
  { code, request }: ApiServerErrorReport = {},
): boolean {
  if (wasReported(error)) return false;
  markReported(error);
  Sentry.withScope((scope) => {
    if (request) scope.setTransactionName(apiTransactionName(request));
    Sentry.captureException(error, { tags: { 'api.code': String(code ?? 'UNKNOWN') } });
  });
  return true;
}
