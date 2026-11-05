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
 * @file Per-document decoding of Sanity answers: one invalid CMS document is dropped and reported
 * instead of failing the whole list, and each answer (by identity) is decoded and reported once,
 * however many requests read it from the cache.
 */

import { makePlace, makeProject, makeResume } from '@tests/fixtures/sanity-docs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlaceSchema, ProjectSchema, ResumeSchema } from '@/hooks/sanity/schemas';
import { resetApiReportCooldowns } from '@/lib/observability/report';
import { decodeEach, decodeOne, resetDecodeMemo } from '@/lib/sanity/decode';

const sentry = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock('@sentry/nextjs', () => sentry);

/** The longest `problem` a report lists per document. */
const MAX_PROBLEM_LENGTH = 300;

interface InvalidDocument {
  readonly id: string;
  readonly problem: string;
}

/** The error and capture context of the `index`th Sentry event. */
const reportAt = (index = 0) => {
  const [error, context] = sentry.captureException.mock.calls[index] ?? [];
  return {
    error: error as { message: string; command: string; metadata: { invalid: InvalidDocument[] } },
    context: context as { level: string; tags: Record<string, string> },
  };
};

beforeEach(() => {
  sentry.captureException.mockReset();
  resetApiReportCooldowns();
  resetDecodeMemo();
});

describe('decodeEach', () => {
  it('keeps every valid document in input order and ignores excess properties', () => {
    const [first, second, third] = [makeProject(), makeProject(), makeProject()];
    const docs = [{ ...third, groqOnlyField: 'dropped' }, first, { ...second, featured: true }];

    const decoded = decodeEach(ProjectSchema, docs, 'projects');

    expect(decoded).toEqual([third, first, { ...second, featured: true }]);
    expect(decoded[0]).not.toHaveProperty('groqOnlyField');
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it('drops an invalid document and sends one warning that lists its _id', () => {
    const good = [makePlace(), makePlace()];
    const workshop = { ...makePlace(), category: 'Workshop' };

    const decoded = decodeEach(PlaceSchema, [good[0], workshop, good[1]], 'places');

    expect(decoded.map((place) => place._id)).toEqual([good[0]?._id, good[1]?._id]);
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    const { error, context } = reportAt();
    expect(error.message).toContain('1 of 3 places documents failed validation');
    expect(error.command).toBe('sanity:decode:places');
    expect(error.metadata.invalid).toEqual([{ id: workshop._id, problem: expect.any(String) }]);
    expect(error.metadata.invalid[0]?.problem).toContain('Workshop');
    expect(context).toMatchObject({ level: 'warning', tags: { 'api.context': 'decode places' } });
  });

  it('lists every invalid document in the one report, with a short problem each', () => {
    const noId = { title: 'No id' };
    const huge = { ...makeProject(), order: 'x'.repeat(2_000) };

    const decoded = decodeEach(ProjectSchema, [noId, makeProject(), huge], 'projects');

    expect(decoded).toHaveLength(1);
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    const { error } = reportAt();
    expect(error.message).toContain('2 of 3 projects documents failed validation');
    expect(error.metadata.invalid.map((doc) => doc.id)).toEqual(['(no _id)', huge._id]);
    expect(error.metadata.invalid[0]?.problem).toMatch(/^_id: /);
    expect(error.metadata.invalid[1]?.problem).toMatch(/^order: Expected number/);
    expect(error.metadata.invalid[1]?.problem).toHaveLength(MAX_PROBLEM_LENGTH);
  });

  it('decodes and reports an answer once per array identity', () => {
    const docs = [makePlace(), { ...makePlace(), category: 'Workshop' }];

    const first = decodeEach(PlaceSchema, docs, 'places');
    // Without the memo, the next call would report again once the cooldown is gone.
    resetApiReportCooldowns();
    const second = decodeEach(PlaceSchema, docs, 'places');

    expect(second).toBe(first);
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it('decodes and reports a new answer with the same content again', () => {
    const workshop = { ...makePlace(), category: 'Workshop' };

    decodeEach(PlaceSchema, [workshop], 'places');
    resetApiReportCooldowns();
    decodeEach(PlaceSchema, [workshop], 'places');

    expect(sentry.captureException).toHaveBeenCalledTimes(2);
  });

  it('forgets every answer on resetDecodeMemo()', () => {
    const docs = [{ ...makePlace(), category: 'Workshop' }];

    decodeEach(PlaceSchema, docs, 'places');
    resetApiReportCooldowns();
    resetDecodeMemo();
    decodeEach(PlaceSchema, docs, 'places');

    expect(sentry.captureException).toHaveBeenCalledTimes(2);
  });

  it('answers a real empty list without reporting', () => {
    expect(decodeEach(ProjectSchema, [], 'projects')).toEqual([]);
    expect(sentry.captureException).not.toHaveBeenCalled();
  });
});

describe('decodeOne', () => {
  it.each([null, undefined])('answers null for %s without a report', (doc) => {
    expect(decodeOne(ResumeSchema, doc, 'resume')).toBeNull();
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it('answers a valid document without its excess properties', () => {
    const resume = makeResume();

    expect(decodeOne(ResumeSchema, { ...resume, asset: 'dropped' }, 'resume')).toEqual(resume);
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it('answers null for an invalid document and sends one warning, once per object', () => {
    const broken = { ...makeResume(), pdfFile: null };

    expect(decodeOne(ResumeSchema, broken, 'resume')).toBeNull();
    resetApiReportCooldowns();
    expect(decodeOne(ResumeSchema, broken, 'resume')).toBeNull();

    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    const { error, context } = reportAt();
    expect(error.message).toContain('1 of 1 resume documents failed validation');
    expect(error.command).toBe('sanity:decode:resume');
    expect(error.metadata.invalid).toEqual([{ id: broken._id, problem: expect.any(String) }]);
    expect(context).toMatchObject({ level: 'warning', tags: { 'api.context': 'decode resume' } });
  });
});
