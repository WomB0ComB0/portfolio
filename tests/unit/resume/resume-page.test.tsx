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
 * @file /resume renders on the server from loadResume(). "Last updated" is the calendar day Sanity
 * stores, even in a US time zone where reading it as local time would show the day before. No
 * active resume is a calm state, not an error; a failed load reaches the route's error page.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Before anything reads the clock: a zone west of UTC, where midnight UTC is still the day before.
vi.hoisted(() => {
  process.env.TZ = 'America/New_York';
});

const h = vi.hoisted(() => ({ loadResume: vi.fn() }));

// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
vi.mock('@/lib/sanity/loaders', () => ({ loadResume: h.loadResume }));

import { makeResume } from '@tests/fixtures/sanity-docs';
import ResumeLoading from '@/app/(routes)/(main)/(professioal)/resume/loading';
import ResumePage from '@/app/(routes)/(main)/(professioal)/resume/page';

const RESUME_FILE = 'src/app/(routes)/(main)/(professioal)/resume/_interface/resume/resume.tsx';
const PDF_REF = 'file-0123abcd-pdf';
const PDF_URL = 'https://cdn.sanity.io/files/34jrnkds/production/0123abcd.pdf';
const NO_RESUME = 'No resume is published right now';

const RESUME = makeResume({
  title: 'Software Engineer Resume',
  pdfFile: { _type: 'file', asset: { _ref: PDF_REF, _type: 'reference' } },
  lastUpdated: '2026-10-01',
});

async function renderPage() {
  return render(await ResumePage());
}

beforeEach(() => {
  h.loadResume.mockReset();
  h.loadResume.mockResolvedValue(RESUME);
});

afterEach(cleanup);

describe('/resume last updated date', () => {
  it('runs in a zone where a UTC midnight is still the previous day', () => {
    expect(new Date('2026-10-01T00:00:00Z').getDate()).toBe(30);
  });

  it('shows a YYYY-MM-DD value as that calendar day', async () => {
    await renderPage();

    expect(screen.getByText('Last updated: October 1, 2026')).toBeInTheDocument();
  });

  it("shows a full timestamp's UTC day", async () => {
    h.loadResume.mockResolvedValue({ ...RESUME, lastUpdated: '2026-10-01T02:30:00.000Z' });

    await renderPage();

    expect(screen.getByText('Last updated: October 1, 2026')).toBeInTheDocument();
  });

  it('shows N/A for a value that is not a date', async () => {
    h.loadResume.mockResolvedValue({ ...RESUME, lastUpdated: 'soon' });

    await renderPage();

    expect(screen.getByText('Last updated: N/A')).toBeInTheDocument();
  });
});

describe('/resume from the server', () => {
  it('embeds the PDF lazily, with an Open PDF link that is a real link', async () => {
    await renderPage();

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: RESUME.title })).toBeInTheDocument();
    // Not named `frame`: Biome reads expect(frame) as a Playwright Frame and wants an await.
    const viewer = screen.getByTitle('Resume PDF');
    expect(viewer.tagName).toBe('IFRAME');
    expect(viewer).toHaveAttribute('src', `${PDF_URL}#view=FitH`);
    expect(viewer).toHaveAttribute('loading', 'lazy');

    const open = screen.getByRole('link', { name: 'Open PDF' });
    expect(open).toHaveAttribute('href', PDF_URL);
    expect(open).toHaveAttribute('target', '_blank');
    expect(open).toHaveAttribute('rel', 'noopener noreferrer');
    // A link inside a <button> is two controls in one; the link stands on its own.
    expect(open.closest('button')).toBeNull();
  });

  it('shows a calm "no resume" state, without the frame, when none is active', async () => {
    h.loadResume.mockResolvedValue(null);

    const { container } = await renderPage();

    expect(screen.getByText(NO_RESUME)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Resume' })).toBeInTheDocument();
    expect(container.querySelector('iframe')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Open PDF' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(container.innerHTML).not.toContain('destructive');
  });

  it('lets a failed load reach the route error boundary', async () => {
    h.loadResume.mockRejectedValue(new Error('Sanity is down'));

    await expect(ResumePage()).rejects.toThrow('Sanity is down');
  });

  // Without JavaScript, a cold load shows only this skeleton: the page streams into a hidden
  // element that only a script reveals. The header must already be the page's own, h1 included.
  it("loads as the page's own header over a 70vh frame", () => {
    render(<ResumeLoading />);

    const heading = screen.getByRole('heading', { level: 1, name: 'Resume' });
    expect(heading.closest('.page-header')).not.toBeNull();
    // The header is the page's, not part of what is loading; the frame and the date need data.
    const status = screen.getByRole('status', { name: 'Loading resume' });
    expect(status).not.toContainElement(heading);
    expect(status.querySelector('.h-\\[70vh\\]')).not.toBeNull();
    expect(screen.queryByText(/Last updated/)).not.toBeInTheDocument();
  });

  it('is a server component with no entrance animation', () => {
    const source = readFileSync(join(process.cwd(), RESUME_FILE), 'utf8');

    expect(source).not.toContain("'use client'");
    expect(source).not.toMatch(/from '(?:framer-motion|motion\/react)'/);
    expect(source).not.toMatch(/from '@\/(?:hooks|components)'/);
  });
});
