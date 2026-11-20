/**
 * Copyright 2026 Mike Odnis
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

import { canWarnForLink } from '@/lib/link-health/public-warning';
import type { LinkHealthEntry, LinkHealthResponse, LinkHealthScope } from '@/lib/link-health/types';

/**
 * How often a visible tab asks again. The scheduled check rewrites the data once an hour, so the
 * first read on a page load plus one every 15 minutes is plenty; a hidden tab asks nothing.
 */
export const LINK_HEALTH_POLL_MS = 15 * 60_000;
const POLL_MS = LINK_HEALTH_POLL_MS;
const REQUEST_MS = 5_000;
const WARNING_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const CLOCK_SLACK_MS = 60_000;
export const EMPTY_LINK_HEALTH: LinkHealthResponse = { links: {} };
const STATUSES = new Set(['reachable', 'unavailable', 'unknown']);
const warning = (entry: LinkHealthEntry): boolean => entry.status === 'unavailable';

/** Invalid, future-dated and expired observations cannot support a public warning. */
export function freshWarning(
  entry: LinkHealthEntry | undefined,
  now: number,
  href?: string,
): LinkHealthEntry | null {
  if (!entry || !warning(entry) || (href !== undefined && !canWarnForLink(href))) return null;
  const checked = Date.parse(entry.checkedAt);
  return Number.isFinite(checked) &&
    checked <= now + CLOCK_SLACK_MS &&
    now - checked < WARNING_MAX_AGE_MS
    ? entry
    : null;
}

function responseOf(value: unknown): LinkHealthResponse {
  if (
    !value ||
    typeof value !== 'object' ||
    !('links' in value) ||
    !value.links ||
    typeof value.links !== 'object' ||
    Array.isArray(value.links)
  )
    throw new Error('Invalid link health response');
  const links: Record<string, LinkHealthEntry> = {};
  for (const [href, entry] of Object.entries(value.links).slice(0, 500)) {
    if (
      !entry ||
      typeof entry !== 'object' ||
      !('status' in entry) ||
      !('checkedAt' in entry) ||
      typeof entry.status !== 'string' ||
      !STATUSES.has(entry.status) ||
      typeof entry.checkedAt !== 'string' ||
      entry.checkedAt.length > 64 ||
      !Number.isFinite(Date.parse(entry.checkedAt))
    )
      continue;
    Object.defineProperty(links, href, {
      value: { status: entry.status, checkedAt: entry.checkedAt },
      enumerable: true,
      configurable: true,
    });
  }
  return { links };
}

export type LinkHealthFetcher = (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>;

export interface LinkHealthStore {
  getSnapshot(): LinkHealthResponse;
  subscribe(listener: () => void): () => void;
}

/**
 * One request, deadline and refresh clock shared by every badge for this scope. No target URLs are
 * sent. The read uses the browser's default cache mode: `no-store` made browsers send
 * `Cache-Control: no-cache`, which can ask the CDN to skip its copy. The answer's max-age=0
 * already keeps browsers from holding it.
 */
export function createLinkHealthStore(
  scope: LinkHealthScope,
  fetcher: LinkHealthFetcher = (...args) => fetch(...args),
): LinkHealthStore {
  let snapshot = EMPTY_LINK_HEALTH;
  const listeners = new Set<() => void>();
  let lastAttempt: number | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let request: { controller: AbortController; timeout: ReturnType<typeof setTimeout> } | undefined;
  const active = (): boolean =>
    listeners.size > 0 && typeof document !== 'undefined' && document.visibilityState === 'visible';
  const publish = (next: LinkHealthResponse): void => {
    snapshot = next;
    for (const listener of listeners) listener();
  };
  const expire = (): void => {
    const kept = Object.entries(snapshot.links).filter(
      ([, entry]) => !warning(entry) || freshWarning(entry, Date.now()),
    );
    if (kept.length !== Object.keys(snapshot.links).length)
      publish({ links: Object.fromEntries(kept) });
  };
  const abort = (): void => {
    const running = request;
    request = undefined;
    if (running) {
      clearTimeout(running.timeout);
      running.controller.abort();
    }
  };
  const schedule = (): void => {
    clearTimeout(timer);
    timer = undefined;
    if (!active()) return;
    const now = Date.now();
    const pollAt = request ? Number.POSITIVE_INFINITY : (lastAttempt ?? now - POLL_MS) + POLL_MS;
    const expiry = Object.values(snapshot.links).reduce((soonest, entry) => {
      const at = Date.parse(entry.checkedAt) + WARNING_MAX_AGE_MS;
      return warning(entry) && at > now ? Math.min(soonest, at) : soonest;
    }, Number.POSITIVE_INFINITY);
    const next = Math.min(pollAt, expiry);
    if (Number.isFinite(next)) timer = setTimeout(tick, Math.max(0, next - now));
  };
  const read = (): void => {
    lastAttempt = Date.now();
    const controller = new AbortController();
    const running = {
      controller,
      timeout: setTimeout(() => {
        if (request !== running) return;
        abort();
        expire();
        schedule();
      }, REQUEST_MS),
    };
    request = running;
    void (async () => {
      try {
        const response = await fetcher(`/api/v1/link-health?scope=${encodeURIComponent(scope)}`, {
          method: 'GET',
          credentials: 'omit',
          headers: { accept: 'application/json' },
          signal: controller.signal,
        });
        if (!response.ok) return;
        const next = responseOf(await response.json());
        if (request === running && !controller.signal.aborted) {
          publish(next);
          expire();
        }
      } catch {
        // Keep the last observation until its own expiry. The next interval can recover.
      } finally {
        clearTimeout(running.timeout);
        if (request === running) {
          request = undefined;
          schedule();
        }
      }
    })();
  };
  function tick(): void {
    if (!active()) return;
    expire();
    if (!request && (lastAttempt === null || Date.now() - lastAttempt >= POLL_MS)) read();
    schedule();
  }
  const visibility = (): void => {
    if (active()) tick();
    else {
      clearTimeout(timer);
      timer = undefined;
      abort();
    }
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1 && typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', visibility);
        tick();
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          clearTimeout(timer);
          timer = undefined;
          // React StrictMode may resubscribe synchronously. Keep its initial read; a genuine
          // unmount still aborts before another task, without resetting the request cooldown.
          queueMicrotask(() => {
            if (listeners.size === 0) abort();
          });
          if (typeof document !== 'undefined')
            document.removeEventListener('visibilitychange', visibility);
        }
      };
    },
  };
}
