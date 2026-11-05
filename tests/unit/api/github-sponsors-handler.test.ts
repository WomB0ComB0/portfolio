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
 * @file The GitHub Sponsors handlers answer a failed fetch with a fixed 500 body. A BaseError's
 * message names the internal command and the upstream failure, so it stays in the log. The
 * failure is reported to Sentry once per context, and never on top of an earlier report.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sponsors = vi.hoisted(() => ({
  getGitHubSponsors: vi.fn(),
  getActiveSponsors: vi.fn(),
}));
const sentry = vi.hoisted(() => ({ captureException: vi.fn() }));

vi.mock('@/lib/api-integrations/github-sponsors', () => sponsors);
vi.mock('@sentry/nextjs', () => sentry);
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});

import {
  getActiveSponsorsHandler,
  getGitHubSponsorsHandler,
} from '@/app/api/v1/[[...route]]/github-sponsors/handlers';
import { BaseError } from '@/classes/error';
import { reportError, resetApiReportCooldowns } from '@/lib/observability/report';
import { logger } from '@/utils';

beforeEach(() => {
  resetApiReportCooldowns();
  sentry.captureException.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe.each([
  ['all sponsors', getGitHubSponsorsHandler, sponsors.getGitHubSponsors, 'fetch sponsors'],
  [
    'active sponsors',
    getActiveSponsorsHandler,
    sponsors.getActiveSponsors,
    'fetch active sponsors',
  ],
] as const)('GET %s', (_name, handler, fetchSponsors, context) => {
  it('answers 500 without the internal command or the upstream message', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    fetchSponsors.mockRejectedValueOnce(
      new BaseError(new Error('upstream said no'), 'github:sponsors'),
    );

    const res = await handler();
    const body = await res.text();

    expect(res.status).toBe(500);
    expect(body).not.toContain('github:sponsors');
    expect(body).not.toContain('upstream said no');
    expect(JSON.parse(body)).toMatchObject({ message: 'Unknown error' });
  });

  it('logs the failure and reports it to Sentry once, tagged with its context', async () => {
    const logError = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const error = new BaseError(new Error('upstream said no'), 'github:sponsors');
    fetchSponsors.mockRejectedValueOnce(error);

    const res = await handler();

    expect(res.status).toBe(500);
    expect(logError).toHaveBeenCalledWith(expect.stringContaining('[GitHub Sponsors API]'), error);
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    expect(sentry.captureException).toHaveBeenCalledWith(error, {
      level: 'error',
      tags: { 'api.context': context },
      fingerprint: ['api', context, '{{ default }}'],
    });
  });

  it('does not report a failure the fetch already reported', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    // The fetch reported the error itself, or reported the upstream error and then threw it
    // wrapped in a BaseError (the dedupe follows `cause`).
    const reportedItself = new BaseError(new Error('rate limited'), 'github:sponsors');
    const upstream = new Error('upstream said no');
    reportError(reportedItself);
    reportError(upstream);
    sentry.captureException.mockClear();

    for (const thrown of [reportedItself, new BaseError(upstream, 'github:sponsors')]) {
      fetchSponsors.mockRejectedValueOnce(thrown);
      const res = await handler();
      expect(res.status).toBe(500);
    }
    expect(sentry.captureException).not.toHaveBeenCalled();
  });
});
