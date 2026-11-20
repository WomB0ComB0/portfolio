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
 * @file What the /media page tests share (media-feed-page.test.tsx and
 * media-feed-page-see-also.test.tsx): one post, six uploads (three of them one stream), the page
 * rendered as the server sends it, and the queries the cases read it with. Not a test file. The
 * loaders are mocked by each test file itself (vi.mock is per file); serverHtml imports the page
 * on every call, so it always gets that file's mocks.
 *
 * The page streams its strip and its list (StreamedMediaFeed), so serverHtml renders it with
 * react-dom/static's prerender, which waits for every boundary as the server's stream does, and
 * firstFlushHtml with renderToString, which shows what is in the HTML before the feed is in.
 *
 * serverHtml keeps every finished part in its place (progressiveChunkSize: Infinity), as the
 * browser shows the page once React's inline script has moved each streamed part in. With React's
 * default chunk size a part as big as the list is sent after its skeleton, in a hidden segment
 * that script moves (`outline: true` renders it so).
 */

import { makeVideo } from '@tests/fixtures/sanity-docs';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import type { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { prerender } from 'react-dom/static';
import type { Blog } from '@/app/api/v1/[[...route]]/blog/handlers';

export const POST_URL = 'https://blog.example.dev/building-a-real-time-chat-app';
export const POST: Blog = {
  title: 'Building a real-time chat app',
  slug: 'building-a-real-time-chat-app',
  publishedAt: '2025-11-11T08:39:40.000Z',
  excerpt: 'Messages arrive instantly.',
  source: 'hashnode',
  url: POST_URL,
};

/** Twitch's own line on a broadcast it exported to YouTube. */
export const TWITCH_LINE =
  'Broadcasted live on Twitch -- Watch live at https://www.twitch.tv/someone';

export const VIDEOS = [
  makeVideo({
    _id: 'resq',
    title: 'Company overview',
    description: '',
    videoId: 'resq0000001',
    publishedDate: '2026-05-05T01:33:15Z',
    duration: '11:34',
  }),
  makeVideo({
    _id: 'm3',
    title: 'Coding marathon.',
    description: TWITCH_LINE,
    videoId: 'mara0000003',
    publishedDate: '2025-12-30T05:03:52Z',
    duration: '8:32:20',
  }),
  makeVideo({
    _id: 'm2',
    title: 'Coding marathon. (Part 2/2)',
    description: TWITCH_LINE,
    videoId: 'mara0000002',
    publishedDate: '2025-12-29T09:00:00Z',
    duration: '2:04:43',
  }),
  makeVideo({
    _id: 'm1',
    title: 'Coding marathon. (Part 1/2)',
    // An early upload without Twitch's line: the shared base title still makes it a stream.
    description: '',
    videoId: 'mara0000001',
    publishedDate: '2025-12-29T08:00:00Z',
    duration: '11:55:01',
  }),
  makeVideo({
    _id: 'lone',
    title: 'Project 4 (part 1) - Coding agent',
    description: '',
    videoId: 'lone0000001',
    publishedDate: '2024-11-22T04:39:54Z',
    duration: '28:39',
  }),
  makeVideo({
    _id: 'old',
    title: 'Networking in tech',
    description: '',
    videoId: 'oldv0000001',
    publishedDate: '2024-09-24T20:28:10Z',
    duration: '26:02',
  }),
];

/** The URL value of the three-upload stream above. */
export const SERIES = 'coding-marathon';
export const watch = (id: string): string => `https://www.youtube.com/watch?v=${id}`;

/** The page for `params` inside the URL adapter its island reads, as the server renders it. */
export async function pageElement(params: Record<string, string> = {}): Promise<ReactElement> {
  const { default: MediaPage } = await import('@/app/(routes)/(dev)/media/page');
  const page: ReactElement = await MediaPage({ searchParams: Promise.resolve(params) });
  const search = new URLSearchParams(params).toString();
  return <NuqsTestingAdapter searchParams={search ? `?${search}` : ''}>{page}</NuqsTestingAdapter>;
}

export interface PrerenderOptions {
  /** Hears what a streamed part threw (React renders its fallback, for the client to retry). */
  readonly onError?: (error: unknown) => void;
  /** Leaves React's default chunk size, so a large part is sent after its skeleton (see above). */
  readonly outline?: boolean;
}

/** `element` once every Suspense boundary has settled, as HTML; no client JS is run. */
export async function prerenderHtml(
  element: ReactElement,
  { onError, outline = false }: PrerenderOptions = {},
): Promise<string> {
  const { prelude } = await prerender(element, {
    onError,
    ...(outline ? {} : { progressiveChunkSize: Number.POSITIVE_INFINITY }),
  });
  return new Response(prelude).text();
}

/** /media for `params`, as the browser shows it once every streamed part is in (see above). */
export async function serverHtml(
  params: Record<string, string> = {},
  options?: PrerenderOptions,
): Promise<string> {
  return prerenderHtml(await pageElement(params), options);
}

/** /media for `params` before any streamed part is in: renderToString shows every fallback. */
export async function firstFlushHtml(params: Record<string, string> = {}): Promise<string> {
  return renderToString(await pageElement(params));
}

/** The HTML parsed, for queries. */
export const parse = (html: string): HTMLElement => {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
};

/** An element's text, single-spaced, without the invisible joiner before a new-tab arrow. */
export const textOf = (element: Element | null | undefined): string =>
  (element?.textContent ?? '').replaceAll('⁠', '').replaceAll(/\s+/g, ' ').trim();

/** The distinct chips the bar offers, by slug. */
export const chipSlugs = (root: HTMLElement): string[] => [
  ...new Set(
    Array.from(
      root.querySelectorAll('[data-chip]'),
      (chip) => chip.getAttribute('data-chip') ?? '',
    ),
  ),
];

/** Each section as its heading and the addresses of its rows, in page order. */
export const sections = (root: HTMLElement): [heading: string, hrefs: (string | null)[]][] =>
  Array.from(root.querySelectorAll('[data-index-part="group"]'), (section) => [
    textOf(section.querySelector('h2')),
    Array.from(section.querySelectorAll('a[data-feed-title]'), (link) => link.getAttribute('href')),
  ]);

/** The row whose title links `href`. */
export const rowOf = (root: HTMLElement, href: string): HTMLTableRowElement | null =>
  root.querySelector(`a[data-feed-title][href="${href}"]`)?.closest('tr') ?? null;
