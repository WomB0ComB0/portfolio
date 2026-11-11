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
 * @file The Better Stack logger can never stop the module that imports it from loading. Every
 * /api/v1 route imports it, so a throw at load takes the whole API down. It sends logs only when
 * both the source token and the ingesting host are set; otherwise, or if Logtail throws anyway,
 * it logs to the console and warns once, naming what is missing and never what is set.
 */

import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';

const TOKEN = 'tok_test_value_not_to_be_printed';
const HOST = 's123456.eu-central-1a.betterstackdata.com';

/** Loads a fresh copy of the logger module with `vars` as the validated env. */
async function load(vars: Record<string, string | undefined>) {
  vi.resetModules();
  vi.doMock('@/env', () => {
    const env = { NODE_ENV: 'production', ...vars };
    return { env, default: env };
  });
  return import('@/lib/better-stack');
}

/** Swaps Logtail for a stand-in that records its arguments, or throws `error` when given one. */
function stubLogtail(error?: Error): unknown[][] {
  const constructed: unknown[][] = [];
  vi.doMock('@logtail/node', () => ({
    Logtail: class {
      constructor(...args: unknown[]) {
        if (error) throw error;
        constructed.push(args);
      }
    },
  }));
  return constructed;
}

describe('the Better Stack logger', () => {
  let warn: MockInstance<typeof console.warn>;

  beforeEach(() => {
    // The module registers flush-on-exit handlers; keep them off the test worker's process.
    vi.spyOn(process, 'on').mockReturnValue(process);
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.doUnmock('@/env');
    vi.doUnmock('@logtail/node');
    vi.restoreAllMocks();
  });

  it('loads with a token but no ingesting host, which @logtail/node 0.6 throws on', async () => {
    await expect(load({ BETTERSTACK_SOURCE_TOKEN: TOKEN })).resolves.toBeDefined();

    expect(warn).toHaveBeenCalledOnce();
    const message = warn.mock.calls.flat().join(' ');
    expect(message).toContain('BETTERSTACK_INGESTING_HOST');
    expect(message).not.toContain('BETTERSTACK_SOURCE_TOKEN');
    expect(message).not.toContain(TOKEN);
  });

  it('names the source token, not the host, when only the host is set', async () => {
    await expect(load({ BETTERSTACK_INGESTING_HOST: HOST })).resolves.toBeDefined();

    expect(warn).toHaveBeenCalledOnce();
    const message = warn.mock.calls.flat().join(' ');
    expect(message).toContain('BETTERSTACK_SOURCE_TOKEN');
    expect(message).not.toContain(HOST);
  });

  it('sends to Better Stack at the https ingesting host when both are set', async () => {
    const constructed = stubLogtail();

    await load({ BETTERSTACK_SOURCE_TOKEN: TOKEN, BETTERSTACK_INGESTING_HOST: HOST });

    expect(constructed).toHaveLength(1);
    expect(constructed[0]?.[0]).toBe(TOKEN);
    expect(constructed[0]?.[1]).toMatchObject({
      endpoint: `https://${HOST}`,
      sendLogsToBetterStack: true,
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it('falls back to the console when Logtail throws anyway', async () => {
    stubLogtail(new Error('Better Stack endpoint missing'));

    const mod = await load({ BETTERSTACK_SOURCE_TOKEN: TOKEN, BETTERSTACK_INGESTING_HOST: HOST });

    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls.flat().join(' ')).not.toContain(TOKEN);
    await expect(mod.flushLogs()).resolves.toBeUndefined();
  });

  it('stays quiet in production when Better Stack is not set up at all, but still shows errors', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mod = await load({});

    mod.logAPIRequest({ method: 'GET', path: '/api/v1/health', statusCode: 200, duration: 3 });
    mod.logError(new Error('boom'));

    // Neither variable set is a deliberate setup, not a half-finished one: no warning per cold
    // start, and no line per request in the host's logs (the old client dropped them too).
    expect(warn).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith('boom', expect.objectContaining({ name: 'Error' }));
  });

  it('writes every level to the console in development while sending is off', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mod = await load({ NODE_ENV: 'development' });

    mod.logAPIRequest({ method: 'GET', path: '/api/v1/health', statusCode: 200, duration: 3 });
    mod.logError(new Error('boom'));

    expect(info).toHaveBeenCalledWith(
      'GET /api/v1/health 200',
      expect.objectContaining({ path: '/api/v1/health', statusCode: 200 }),
    );
    expect(error).toHaveBeenCalledWith('boom', expect.objectContaining({ name: 'Error' }));
    expect(warn).not.toHaveBeenCalled();
  });
});
