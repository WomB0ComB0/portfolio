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

/**
 * @file The message of a non-2xx error quotes at most 200 characters of the upstream body, as the
 * parse failure's message does. Before this, the whole body went into the message, so a
 * multi-megabyte error page became a multi-megabyte message, logged and sent to Sentry. The
 * message is built from the status and the body only: no request header can reach it.
 */

import { Effect, Result } from 'effect';
import { FetchHttpClient } from 'effect/http';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The fetcher only reads env for the Vercel bypass header; skip t3-env validation in tests.
vi.mock('@/env', () => ({ env: {}, default: {} }));

import { FetcherError, get } from '@/lib/http-clients/effect-fetcher';

const URL_UNDER_TEST = 'https://api.example.com/items';
/** Made-up credentials: the tests look for them in the message. */
const KEY = 'made-up-api-key-0123456789';
const TOKEN = 'made-up-token-9876543210';

const failWith = async (status: number, body: string): Promise<FetcherError> => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(body, { status, headers: { 'Content-Type': 'text/html' } })),
  );
  const result = await Effect.runPromise(
    Effect.result(
      get(URL_UNDER_TEST, {
        retries: 0,
        headers: { 'X-Goog-Api-Key': KEY, Authorization: `Bearer ${TOKEN}` },
      }).pipe(Effect.provide(FetchHttpClient.layer)),
    ),
  );
  if (Result.isSuccess(result)) throw new Error('expected the request to fail');
  expect(result.failure).toBeInstanceOf(FetcherError);
  return result.failure as FetcherError;
};

describe('effect-fetcher: the message of a non-2xx error', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('quotes the first 200 characters of a long body, then an ellipsis', async () => {
    const body = 'Internal error. '.repeat(100_000);
    const error = await failWith(500, body);

    expect(error.message).toBe(`HTTP 500: ${body.slice(0, 200)}...`);
    expect(error.message.length).toBe('HTTP 500: '.length + 203);
    expect(error.status).toBe(500);
  });

  it('quotes a body of 200 characters or fewer whole', async () => {
    const exact = 'x'.repeat(200);
    expect((await failWith(503, 'Internal error')).message).toBe('HTTP 503: Internal error');
    expect((await failWith(404, exact)).message).toBe(`HTTP 404: ${exact}`);
  });

  it("quotes an HTML error page by its title, never its markup (a CDN's 521 page)", async () => {
    const page = [
      '<!DOCTYPE html>',
      '<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->',
      '<!--[if gt IE 8]><!--> <html class="no-js" lang="en-US"> <!--<![endif]-->',
      '<head>',
      '<title>uptime.example.com | 521: Web server is down</title>',
      '<style>body { margin: 0 }</style>',
      '</head><body><h1>Web server is down</h1></body></html>',
    ].join('\n');
    const error = await failWith(521, page);

    expect(error.message).toBe(
      'HTTP 521: HTML page "uptime.example.com | 521: Web server is down"',
    );
    expect(error.message).not.toContain('<');
    expect(error.status).toBe(521);
  });

  it("quotes an HTML page without a title by its text, and an empty one as 'HTML page'", async () => {
    expect((await failWith(503, '<html>Internal  error\n</html>')).message).toBe(
      'HTTP 503: HTML page "Internal error"',
    );
    expect((await failWith(502, '<html><body></body></html>')).message).toBe('HTTP 502: HTML page');
    const long = `<html><body>${'Internal error. '.repeat(1_000)}</body></html>`;
    const { message } = await failWith(500, long);
    expect(message.startsWith('HTTP 500: HTML page "Internal error. Internal error.')).toBe(true);
    expect(message.endsWith('..."')).toBe(true);
  });

  it('falls back to the text for an empty title, and never quotes inline CSS, JS or a cut-off tag', async () => {
    const page = (head: string, body: string) =>
      `<!DOCTYPE html><html><head>${head}</head><body>${body}</body></html>`;

    expect(
      (await failWith(503, page('<title> </title>', '<h1>503 Service Unavailable</h1>'))).message,
    ).toBe('HTTP 503: HTML page "503 Service Unavailable"');
    expect(
      (
        await failWith(
          502,
          page(
            '<style>body{margin:0;font:14px sans-serif}</style><script>if(a<b){x()}</script>',
            '<h1>502 Bad Gateway</h1>',
          ),
        )
      ).message,
    ).toBe('HTTP 502: HTML page "502 Bad Gateway"');
    // A head of meta tags longer than the scan, cut mid-tag: the partial tag is not quoted.
    const metas = Array.from({ length: 160 }, (_, i) => `<meta name="m${i}" content="x">`).join('');
    expect((await failWith(500, page(metas, '<h1>Down</h1>'))).message).toBe('HTTP 500: HTML page');
  });

  it('drops a script or style block that runs past the scan limit, keeping the text before it', async () => {
    const css = `.a{color:red}`.repeat(400);
    const styled = `<!DOCTYPE html><html><head><style>${css}</style></head><body><h1>Down</h1></body></html>`;
    expect((await failWith(503, styled)).message).toBe('HTTP 503: HTML page');

    const js = 'window.x=1;'.repeat(500);
    const scripted = `<html><body><h1>Bad Gateway</h1><script>${js}</script></body></html>`;
    expect((await failWith(502, scripted)).message).toBe('HTTP 502: HTML page "Bad Gateway"');
  });

  it("quotes the document's own title, not an SVG icon's in the body", async () => {
    const body = '<html><body><svg><title>logo</title></svg><h1>Error 500</h1></body></html>';
    expect((await failWith(500, body)).message).toBe('HTTP 500: HTML page "Error 500"');
  });

  it('leaves a body that only mentions HTML as it is', async () => {
    const body = '{"error":"expected JSON, got <html>"}';
    expect((await failWith(400, body)).message).toBe(`HTTP 400: ${body}`);
  });

  it('carries no request header, whatever the status', async () => {
    for (const status of [400, 401, 403, 404, 500, 502]) {
      const { message } = await failWith(status, 'Request failed upstream');
      expect(message).toBe(`HTTP ${status}: Request failed upstream`);
      expect(message).not.toContain(KEY);
      expect(message).not.toContain(TOKEN);
    }
  });
});
