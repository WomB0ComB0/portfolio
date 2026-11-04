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
 * @file public/sw.js replaces the Workbox worker older builds registered at /sw.js. It must take
 * over at once, clear the old caches, unregister itself, never handle fetches and never reload
 * open tabs. The script runs in a vm context whose global object stands in for
 * ServiceWorkerGlobalScope (`self`, `caches`, `registration`, `clients`, `skipWaiting`).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

// import.meta.url is not a file: URL under Vitest, so resolve from the working directory instead.
const ROOT = process.cwd();
const WORKER_SOURCE = readFileSync(join(ROOT, 'public/sw.js'), 'utf8');

/** Cache names the next-pwa worker created (precache, start URL and the runtime caches). */
const OLD_CACHES = [
  'workbox-precache-v2-https://mikeodnis.dev/',
  'start-url',
  'pages',
  'images',
  'static-resources',
  'fonts',
  'api-responses',
];

interface FakeEvent {
  waitUntil: ReturnType<typeof vi.fn>;
}
type Listener = (event: FakeEvent) => void;

interface WorkerOptions {
  keys?: () => Promise<string[]>;
  deleteCache?: (key: string) => Promise<boolean>;
}

function loadWorker(options: WorkerOptions = {}) {
  const order: string[] = [];
  const listeners = new Map<string, Listener[]>();
  const navigate = vi.fn(async () => null);

  const scope: Record<string, unknown> = {
    addEventListener: vi.fn((type: string, listener: Listener) => {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    }),
    skipWaiting: vi.fn(async () => {
      order.push('skipWaiting');
    }),
    registration: {
      unregister: vi.fn(async () => {
        order.push('unregister');
        return true;
      }),
    },
    clients: {
      claim: vi.fn(async () => undefined),
      matchAll: vi.fn(async () => [{ url: 'https://mikeodnis.dev/places', navigate }]),
    },
    caches: {
      keys: vi.fn(options.keys ?? (async () => [...OLD_CACHES])),
      delete: vi.fn(async (key: string) => {
        order.push(`delete:${key}`);
        return options.deleteCache ? options.deleteCache(key) : true;
      }),
    },
  };
  // In a worker, `self` is the global object itself.
  scope.self = scope;
  vm.runInContext(WORKER_SOURCE, vm.createContext(scope), { filename: 'public/sw.js' });

  /** Fires an event at every listener and resolves once all waitUntil() promises settle. */
  const dispatch = (type: string) => {
    const pending: Promise<unknown>[] = [];
    const event: FakeEvent = {
      waitUntil: vi.fn((promise: Promise<unknown>) => {
        pending.push(Promise.resolve(promise));
      }),
    };
    for (const listener of listeners.get(type) ?? []) listener(event);
    return { event, done: Promise.all(pending) };
  };

  const registration = scope.registration as { unregister: ReturnType<typeof vi.fn> };
  const clients = scope.clients as {
    claim: ReturnType<typeof vi.fn>;
    matchAll: ReturnType<typeof vi.fn>;
  };
  const caches = scope.caches as {
    keys: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  return { scope, listeners, order, navigate, dispatch, registration, clients, caches };
}

describe('retired service worker (public/sw.js)', () => {
  it('listens only for install and activate, so it never answers fetches', () => {
    const { listeners, scope } = loadWorker();

    expect([...listeners.keys()].sort()).toEqual(['activate', 'install']);
    for (const type of ['install', 'activate']) {
      expect(listeners.get(type), type).toHaveLength(1);
    }
    expect(scope.onfetch).toBeUndefined();
    expect(scope.onmessage).toBeUndefined();
  });

  it('does nothing until the browser fires its lifecycle events', () => {
    const { scope, registration, caches } = loadWorker();

    expect(scope.skipWaiting).not.toHaveBeenCalled();
    expect(registration.unregister).not.toHaveBeenCalled();
    expect(caches.keys).not.toHaveBeenCalled();
  });

  it('skips waiting on install, so it replaces the old worker straight away', async () => {
    const { scope, dispatch, registration, caches } = loadWorker();

    await dispatch('install').done;

    expect(scope.skipWaiting).toHaveBeenCalledTimes(1);
    expect(registration.unregister).not.toHaveBeenCalled();
    expect(caches.keys).not.toHaveBeenCalled();
  });

  it('on activate, deletes every cache and then unregisters itself', async () => {
    const { dispatch, order, registration, caches } = loadWorker();

    const { event, done } = dispatch('activate');
    // The browser keeps the worker alive only while the waitUntil() promise is pending.
    expect(event.waitUntil).toHaveBeenCalledTimes(1);
    await done;

    expect(caches.delete.mock.calls.map(([key]) => key).sort()).toEqual([...OLD_CACHES].sort());
    expect(registration.unregister).toHaveBeenCalledTimes(1);
    expect(order.at(-1)).toBe('unregister');
    expect(order.filter((step) => step.startsWith('delete:'))).toHaveLength(OLD_CACHES.length);
  });

  it('never reloads, navigates or claims open tabs', async () => {
    const { dispatch, clients, navigate } = loadWorker();

    await dispatch('install').done;
    await dispatch('activate').done;

    expect(clients.matchAll).not.toHaveBeenCalled();
    expect(clients.claim).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('still deletes the other caches and unregisters when one delete fails', async () => {
    const { dispatch, registration, caches } = loadWorker({
      deleteCache: async (key) => {
        if (key === 'images') throw new Error('delete failed');
        return true;
      },
    });

    await expect(dispatch('activate').done).resolves.toBeDefined();

    expect(caches.delete).toHaveBeenCalledTimes(OLD_CACHES.length);
    expect(registration.unregister).toHaveBeenCalledTimes(1);
  });

  it('still unregisters when Cache Storage is unavailable', async () => {
    const { dispatch, registration, caches } = loadWorker({
      keys: async () => {
        throw new Error('SecurityError');
      },
    });

    await expect(dispatch('activate').done).resolves.toBeDefined();

    expect(caches.delete).not.toHaveBeenCalled();
    expect(registration.unregister).toHaveBeenCalledTimes(1);
  });

  it('unregisters even when there are no caches left', async () => {
    const { dispatch, registration, caches } = loadWorker({ keys: async () => [] });

    await dispatch('activate').done;

    expect(caches.delete).not.toHaveBeenCalled();
    expect(registration.unregister).toHaveBeenCalledTimes(1);
  });
});

describe('build setup around public/sw.js', () => {
  it('has no service worker plugin that would regenerate public/sw.js', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as Record<
      string,
      Record<string, string> | undefined
    >;
    const deps = Object.keys({
      ...pkg.dependencies,
      ...pkg.devDependencies,
      ...pkg.optionalDependencies,
    });

    expect(deps.filter((name) => /next-pwa|workbox/.test(name))).toEqual([]);
  });
});
