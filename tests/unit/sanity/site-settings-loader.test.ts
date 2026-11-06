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
 * @file The site settings as the pages load them: one query by the singleton's fixed id, the
 * shared stale-on-error cache of the other Sanity loaders, and field-by-field decoding.
 * - A valid document is answered trimmed; an empty field (GROQ's null) is simply absent.
 * - Each invalid field is dropped on its own and the rest kept; the document is reported once
 *   per answer, naming every bad field. Something that is not the settings at all is null.
 * - With no document, null and no report.
 * - When Sanity fails after a good load, the last good settings and one warning; with nothing
 *   cached, a rejection with the getter's BaseError and no report of its own.
 * - The peek answers the last settings cached, at once and without asking Sanity.
 * Only the Sanity client, the env and Sentry are mocked.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isBaseError } from '@/classes/error';
import { resetApiReportCooldowns } from '@/lib/observability/report';
import {
  loadSiteSettings,
  peekSiteSettings,
  resetSanityLoaderCaches,
  SANITY_CACHE_TTL_MS,
} from '@/lib/sanity/loaders';
import { siteSettingsQuery } from '@/lib/sanity/queries';
import { logger } from '@/utils';

const sentry = vi.hoisted(() => ({ captureException: vi.fn() }));
const sanity = vi.hoisted(() => ({ sanityFetchWithToken: vi.fn() }));

vi.mock('@sentry/nextjs', () => sentry);
vi.mock('@/lib/sanity/client', () => sanity);
// t3-env validates every production variable on import.
vi.mock('@/env', () => {
  const env = {};
  return { env, default: env };
});

const T0 = new Date('2026-11-06T12:00:00Z').getTime();

/** The settings document as Sanity answers it (synthetic values). */
const SETTINGS = {
  _id: 'siteSettings',
  _type: 'siteSettings',
  location: 'Brooklyn, NY',
  tagline: 'Shipping fraud detection and the web around it.',
  email: 'hello@example.dev',
  githubUrl: 'https://github.com/example',
  linkedinUrl: 'https://www.linkedin.com/in/example/',
};

const sanityDown = () => new Error('Sanity answered 502 Bad Gateway');

const expectOneReport = (level: 'warning' | 'error', context: string) => {
  expect(sentry.captureException).toHaveBeenCalledTimes(1);
  expect(sentry.captureException).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ level, tags: { 'api.context': context } }),
  );
};

/** What the one decode report says is wrong with the document. */
const reportedProblem = (): string => {
  const report = sentry.captureException.mock.calls[0]?.[0] as
    | { metadata?: { invalid?: { problem: string }[] } }
    | undefined;
  return report?.metadata?.invalid?.[0]?.problem ?? '';
};

/** The fields the one decode report lists as invalid, by name. */
const reportedFields = (): string[] =>
  [...reportedProblem().matchAll(/(?:^|; )(\w+):/g)].map(([, field]) => field ?? '');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  sentry.captureException.mockReset();
  sanity.sanityFetchWithToken.mockReset();
  resetSanityLoaderCaches();
  resetApiReportCooldowns();
  vi.spyOn(logger, 'error').mockImplementation(() => undefined);
  vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
  vi.spyOn(logger, 'info').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('loadSiteSettings', () => {
  it('asks Sanity for the singleton by its fixed id and answers every field', async () => {
    sanity.sanityFetchWithToken.mockResolvedValue(SETTINGS);

    expect(await loadSiteSettings()).toEqual(SETTINGS);
    expect(sanity.sanityFetchWithToken).toHaveBeenCalledTimes(1);
    expect(sanity.sanityFetchWithToken.mock.calls[0]?.[0]).toBe(siteSettingsQuery);
    expect(siteSettingsQuery).toContain('_id == "siteSettings"');
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it('trims the text and the links', async () => {
    sanity.sanityFetchWithToken.mockResolvedValue({
      ...SETTINGS,
      location: '  Brooklyn, NY ',
      githubUrl: ' https://github.com/example\n',
    });

    expect(await loadSiteSettings()).toEqual(SETTINGS);
  });

  it('answers a half-filled document with only its fields: an empty one is absent, not null', async () => {
    sanity.sanityFetchWithToken.mockResolvedValue({
      _id: 'siteSettings',
      _type: 'siteSettings',
      location: null,
      tagline: 'Hi.',
      email: null,
      githubUrl: null,
      linkedinUrl: null,
    });

    expect(await loadSiteSettings()).toStrictEqual({
      _id: 'siteSettings',
      _type: 'siteSettings',
      tagline: 'Hi.',
    });
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it('drops each invalid field alone, keeps the rest, and names every bad one in one warning', async () => {
    sanity.sanityFetchWithToken.mockResolvedValue({
      ...SETTINGS,
      location: 'x'.repeat(41),
      tagline: '   ',
      email: 'hello@example.dev?cc=someone@example.org',
      githubUrl: 'http://github.com/example',
    });

    const settings = await loadSiteSettings();
    await loadSiteSettings();

    expect(settings).toStrictEqual({
      _id: 'siteSettings',
      _type: 'siteSettings',
      linkedinUrl: SETTINGS.linkedinUrl,
    });
    expectOneReport('warning', 'decode site-settings');
    expect(reportedFields().sort()).toEqual(['email', 'githubUrl', 'location', 'tagline']);
    // Each field once, in words: the values (an address among them) are never repeated.
    expect(reportedProblem()).not.toContain('someone@example.org');
    expect(reportedProblem()).not.toContain('xxxx');
  });

  it.each([
    ['a javascript: link', 'javascript:alert(1)'],
    ['a link with credentials', 'https://user:secret@github.com/example'],
    ['a relative link', '/example'],
    ['not a string', 42],
  ])('drops %s', async (_, githubUrl) => {
    sanity.sanityFetchWithToken.mockResolvedValue({ ...SETTINGS, githubUrl });

    const settings = await loadSiteSettings();

    expect(settings).not.toHaveProperty('githubUrl');
    expect(settings).toMatchObject({ location: SETTINGS.location, email: SETTINGS.email });
  });

  it('answers null for something that is not the settings at all', async () => {
    sanity.sanityFetchWithToken.mockResolvedValue({ ...SETTINGS, _type: 'project' });

    expect(await loadSiteSettings()).toBeNull();
    expectOneReport('warning', 'decode site-settings');
  });

  it('answers null without a report when the document does not exist yet', async () => {
    sanity.sanityFetchWithToken.mockResolvedValue(null);

    expect(await loadSiteSettings()).toBeNull();
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it('reuses the answer within the TTL', async () => {
    sanity.sanityFetchWithToken.mockResolvedValue(SETTINGS);

    await loadSiteSettings();
    vi.setSystemTime(T0 + SANITY_CACHE_TTL_MS - 1);
    await loadSiteSettings();

    expect(sanity.sanityFetchWithToken).toHaveBeenCalledTimes(1);
  });

  it('answers the last good settings and sends one warning when Sanity fails past the TTL', async () => {
    sanity.sanityFetchWithToken.mockResolvedValueOnce(SETTINGS);
    await loadSiteSettings();

    sanity.sanityFetchWithToken.mockRejectedValue(sanityDown());
    vi.setSystemTime(T0 + SANITY_CACHE_TTL_MS + 1);

    expect(await loadSiteSettings()).toEqual(SETTINGS);
    expectOneReport('warning', 'load site-settings for pages');
    expect(sentry.captureException.mock.calls[0]?.[0]).toMatchObject({
      command: 'sanity:site-settings',
    });
  });

  it("rejects with the getter's BaseError and reports nothing when nothing is cached", async () => {
    sanity.sanityFetchWithToken.mockRejectedValue(sanityDown());

    const error = await loadSiteSettings().then(
      () => undefined,
      (reason: unknown) => reason,
    );

    expect(isBaseError(error)).toBe(true);
    expect(error).toMatchObject({
      command: 'sanity:site-settings',
      cause: expect.objectContaining({ message: 'Sanity answered 502 Bad Gateway' }),
    });
    expect(sentry.captureException).not.toHaveBeenCalled();
  });
});

describe('peekSiteSettings', () => {
  it('answers nothing, and asks Sanity nothing, before the settings were loaded', () => {
    expect(peekSiteSettings()).toBeUndefined();
    expect(sanity.sanityFetchWithToken).not.toHaveBeenCalled();
  });

  it('answers the last settings loaded, decoded, with when, however old', async () => {
    sanity.sanityFetchWithToken.mockResolvedValue({ ...SETTINGS, githubUrl: 'http://x.dev' });
    await loadSiteSettings();
    vi.setSystemTime(T0 + 10 * SANITY_CACHE_TTL_MS);

    const { githubUrl: _dropped, ...valid } = SETTINGS;
    expect(peekSiteSettings()).toEqual({ data: valid, loadedAt: T0 });
    expect(sanity.sanityFetchWithToken).toHaveBeenCalledTimes(1);
    // The load's decode warning only: the peek decodes the same answer, so it is not sent again.
    expectOneReport('warning', 'decode site-settings');
  });

  it('answers null data when Sanity said there is no document', async () => {
    sanity.sanityFetchWithToken.mockResolvedValue(null);
    await loadSiteSettings();

    expect(peekSiteSettings()).toEqual({ data: null, loadedAt: T0 });
  });
});
