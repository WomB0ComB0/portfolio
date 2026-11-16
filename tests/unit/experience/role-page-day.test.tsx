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
 * @file /experience/[id] reads New York's day once per request, for its title and its body
 * alike. A role that begins on the 1st, asked for across midnight in New York while Sanity is
 * slow, must never render under the 404 title, nor answer 404 under the role's title.
 *
 * React's cache() keeps one answer per server request; outside the server (here) React makes it
 * a pass-through, so it is stood in for: one memo per request, cleared before the next.
 */

import { makeExperience } from '@tests/fixtures/sanity-docs';
import { isValidElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  // app.url is read from this variable when the constants module loads.
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://mikeodnis.dev');
});

const h = vi.hoisted(() => ({
  loadExperiences: vi.fn(),
  loadExperienceById: vi.fn(),
  loadProjects: vi.fn(),
  /** Ends the current request: every cache() memo starts again. */
  requestEnds: [] as (() => void)[],
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  /** cache() as a server request has it: the first answer is kept until the request ends. */
  const cache = <T extends (...args: never[]) => unknown>(fn: T): T => {
    let memo: { readonly value: ReturnType<T> } | null = null;
    h.requestEnds.push(() => {
      memo = null;
    });
    return ((...args: Parameters<T>) => {
      memo ??= { value: fn(...args) as ReturnType<T> };
      return memo.value;
    }) as T;
  };
  return { ...actual, cache };
});
vi.mock('@/lib/sanity/loaders', () => ({
  loadExperiences: h.loadExperiences,
  loadExperienceById: h.loadExperienceById,
  loadProjects: h.loadProjects,
  peekProjects: () => undefined,
}));
vi.mock('@/lib/observability/report', () => ({ reportApiFailure: vi.fn() }));
// client.ts require()s '@/env' at load; the page only needs the image URL builder.
vi.mock('@/lib/sanity/client', async () => {
  const { createImageUrlBuilder } = await import('@sanity/image-url');
  const builder = createImageUrlBuilder({ projectId: 'test', dataset: 'test' });
  return { urlFor: (source: Parameters<typeof builder.image>[0]) => builder.image(source) };
});

import ExperienceDetailPage, {
  generateMetadata,
} from '@/app/(routes)/(main)/(professioal)/experience/[id]/page';
import { NOT_FOUND_METADATA } from '@/app/(routes)/not-found';

/** A role that begins on 1 November 2026. */
const FRESH = makeExperience({
  _id: 'fresh',
  order: 0,
  startDate: '2026-11-01',
  endDate: null,
  current: true,
  position: 'Advisor',
  company: 'New Co',
});
/** 23:59:30 on 31 October in New York (EDT). */
const BEFORE_MIDNIGHT = new Date('2026-11-01T03:59:30Z');
/** 00:00:30 on 1 November in New York. */
const AFTER_MIDNIGHT = new Date('2026-11-01T04:00:30Z');

const paramsFor = (id: string) => ({ params: Promise.resolve({ id }) });

/** The page's answer: the role it renders, or the 404 notFound() raises. */
async function pageAnswer(): Promise<'role' | '404'> {
  try {
    const element = await ExperienceDetailPage(paramsFor(FRESH._id));
    return isValidElement(element) ? 'role' : '404';
  } catch (error) {
    if (String((error as { digest?: unknown }).digest ?? '').includes('404')) return '404';
    throw error;
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  for (const end of h.requestEnds) end();
  h.loadExperiences.mockResolvedValue([FRESH]);
  h.loadProjects.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('/experience/[id]: one day per request', () => {
  it('gives the title and the body the same answer when midnight passes while Sanity is slow', async () => {
    let answer = (): void => undefined;
    const sanity = new Promise<void>((resolve) => {
      answer = resolve;
    });
    h.loadExperienceById.mockImplementation(async () => {
      await sanity;
      return FRESH;
    });
    vi.setSystemTime(BEFORE_MIDNIGHT);

    // Next asks for the title and the body side by side; both wait on Sanity past midnight.
    const metadata = generateMetadata(paramsFor(FRESH._id));
    const page = pageAnswer();
    await new Promise((resolve) => setTimeout(resolve, 0));
    vi.setSystemTime(AFTER_MIDNIGHT);
    answer();

    const titled404 = (await metadata).title === NOT_FOUND_METADATA.title;
    expect((await page) === '404').toBe(titled404);
  });

  it('reads the day anew for the next request', async () => {
    h.loadExperienceById.mockResolvedValue(FRESH);
    vi.setSystemTime(BEFORE_MIDNIGHT);
    expect(await pageAnswer()).toBe('404');

    for (const end of h.requestEnds) end();
    vi.setSystemTime(AFTER_MIDNIGHT);
    expect(await pageAnswer()).toBe('role');
  });
});
