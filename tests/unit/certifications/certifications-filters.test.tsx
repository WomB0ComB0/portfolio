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
 * @file The /certifications filters, unified on the shared nuqs `useUrlFilters` hook (?issuer,
 * ?skill, ?q). Verifies server-rendered shared/legacy links, in-place client filtering, debounced
 * search, removable filter tokens, focus management, announcements, and no-JS GET form support.
 */

import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { UrlUpdateEvent } from 'nuqs/adapters/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  loadCertifications: vi.fn(),
}));

// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
vi.mock('@/lib/sanity/loaders', () => ({ loadCertifications: h.loadCertifications }));

import { wideLayout } from '../console/filter-bar/wide-layout';
import {
  ALL_TITLES,
  CERTS,
  chips,
  currentChip,
  itemsOf,
  itemTitles,
  renderPage,
} from './page-fixture';

const GOOGLE_TITLES = ['Build Wireframes', 'BigQuery Basics'];
const UDEMY_TITLES = ['Complete React Developer', 'Udemy TypeScript'];

const chipNamed = (name: RegExp): HTMLElement => within(chips()).getByRole('link', { name });
const status = (): HTMLElement => screen.getByRole('status');
const applied = (): HTMLElement => screen.getByRole('list', { name: 'Applied filters' });
const token = (name: string): HTMLElement => within(applied()).getByRole('link', { name });

let narrow: () => void;

beforeEach(() => {
  narrow = wideLayout();
  h.loadCertifications.mockReset();
  h.loadCertifications.mockResolvedValue(CERTS);
});

afterEach(() => {
  cleanup();
  narrow();
});

describe('filters from the URL, on the server render', () => {
  it('offers All, a chip per family with two or more, and Other, with counts', async () => {
    await renderPage();
    const links = within(chips()).getAllByRole('link');

    expect(links.map((link) => link.textContent)).toEqual([
      'All 7 certificates',
      'Microsoft 2 certificates',
      'Google 2 certificates',
      'Udemy 2 certificates',
      'Other 1 certificate',
    ]);
    expect(currentChip()?.textContent).toMatch(/^All/);
    expect(chipNamed(/^Google/)).toHaveAttribute('href', '/certifications?issuer=google');
  });

  it('?issuer takes a family slug', async () => {
    await renderPage({ issuer: 'google' });

    expect(itemTitles()).toEqual(GOOGLE_TITLES);
    expect(currentChip()?.textContent).toMatch(/^Google/);
  });

  it('?issuer=Google Cloud Skills Boost lands on Google, as today’s shared links do', async () => {
    await renderPage({ issuer: 'Google Cloud Skills Boost' });

    expect(itemTitles()).toEqual(GOOGLE_TITLES);
    expect(currentChip()?.textContent).toMatch(/^Google 2/);
  });

  it('?issuer=IBM filters to IBM, and the Other chip takes its name', async () => {
    await renderPage({ issuer: 'IBM' });

    expect(itemTitles()).toEqual(['Qiskit Global Summer School 2025']);
    expect(currentChip()?.textContent).toBe('IBM 1 certificate');
    expect(currentChip()).toHaveAttribute('href', '/certifications?issuer=ibm');
  });

  it('?skill filters on one part of a joined skill string and shows it as a removable token', async () => {
    await renderPage({ skill: 'react.js', issuer: 'udemy' });

    expect(itemTitles()).toEqual(UDEMY_TITLES);
    expect(
      within(applied())
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Issuer: Udemy', 'Skill: React.js']);
    expect(token('Remove Skill: React.js')).toHaveAttribute('href', '/certifications?issuer=udemy');
    expect(token('Remove Issuer: Udemy')).toHaveAttribute('href', '/certifications?skill=React.js');
    expect(screen.getByRole('link', { name: 'Clear all' })).toHaveAttribute(
      'href',
      '/certifications',
    );
  });

  it('?q matches titles, issuers and skills, ignoring case, and fills the search field', async () => {
    await renderPage({ q: 'REDUX' });

    expect(itemTitles()).toEqual(['Complete React Developer']);
    expect(screen.getByRole('searchbox', { name: 'Search certificates' })).toHaveValue('REDUX');
  });

  it('shows a designed empty state with a Clear link when nothing matches', async () => {
    await renderPage({ q: 'quantum computing' });
    const empty = screen
      .getByRole('heading', { name: 'No certificates match' })
      .closest('[data-state]');

    expect(itemsOf()).toEqual([]);
    expect(empty).toHaveAttribute('data-state', 'empty');
    expect(empty).toHaveTextContent(
      'Nothing matches “quantum computing”. Clear the filters to see all 7.',
    );
    expect(screen.getByRole('link', { name: 'Clear filters' })).toHaveAttribute(
      'href',
      '/certifications',
    );
  });

  it('words the empty state by what filtered: no search means “No certificates from …”', async () => {
    await renderPage({ issuer: 'udemy', skill: 'SQL' });

    expect(screen.getByText(/^No certificates from Udemy with SQL\./)).toHaveTextContent(
      'No certificates from Udemy with SQL. Clear the filters to see all 7.',
    );
  });

  it('searches with a plain GET form, carrying the other filters, so it works without JS', async () => {
    await renderPage({ issuer: 'udemy', skill: 'React.js' });
    const form = screen.getByRole('searchbox').closest('form') as HTMLFormElement;

    expect(form.closest('search')).not.toBeNull();
    expect(form).toHaveAttribute('action', '/certifications');
    expect(form).toHaveAttribute('method', 'get');
    expect(screen.getByRole('searchbox')).toHaveAttribute('name', 'q');
    expect(form.querySelector('input[type="hidden"][name="issuer"]')).toHaveValue('udemy');
    expect(form.querySelector('input[type="hidden"][name="skill"]')).toHaveValue('React.js');
  });
});

describe('filtering in place with JavaScript via nuqs', () => {
  it('a chip filters without a round trip and replaces the URL via nuqs', async () => {
    const updates: UrlUpdateEvent[] = [];
    await renderPage({}, '/certifications', (event) => updates.push(event));

    const prevented = !fireEvent.click(chipNamed(/^Udemy/));

    expect(prevented).toBe(true);
    expect(itemTitles()).toEqual(UDEMY_TITLES);
    expect(currentChip()?.textContent).toMatch(/^Udemy/);
    expect(status()).toHaveTextContent('Showing 2 of 7 certificates');
    await waitFor(() => {
      const last = updates.at(-1);
      expect(last?.queryString).toBe('?issuer=udemy');
      expect(last?.options.history).toBe('replace');
    });
  });

  it('leaves a modified click (a new tab) to the browser', async () => {
    const updates: UrlUpdateEvent[] = [];
    await renderPage({}, '/certifications', (event) => updates.push(event));

    const prevented = !fireEvent.click(chipNamed(/^Udemy/), { ctrlKey: true });

    expect(prevented).toBe(false);
    expect(itemTitles()).toEqual(ALL_TITLES);
    expect(updates).toHaveLength(0);
  });

  it('the search filters as you type and syncs ?q cleanly via nuqs', async () => {
    const updates: UrlUpdateEvent[] = [];
    await renderPage({ issuer: 'udemy' }, '/certifications?issuer=udemy', (event) =>
      updates.push(event),
    );

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'typescript' } });

    await waitFor(() => expect(itemTitles()).toEqual(['Udemy TypeScript']));
    await waitFor(() => {
      expect(updates.at(-1)?.queryString).toContain('issuer=udemy');
      expect(updates.at(-1)?.queryString).toContain('q=typescript');
    });
  });

  it('the skill’s token removes the skill, and Clear filters removes everything', async () => {
    const updates: UrlUpdateEvent[] = [];
    await renderPage(
      { skill: 'React.js', issuer: 'udemy' },
      '/certifications?issuer=udemy&skill=React.js',
      (event) => updates.push(event),
    );

    fireEvent.click(token('Remove Skill: React.js'));
    expect(within(applied()).queryByRole('link', { name: /Skill/ })).toBeNull();
    await waitFor(() => expect(updates.at(-1)?.queryString).toBe('?issuer=udemy'));

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'nothing like this' } });
    await waitFor(() => expect(itemsOf()).toEqual([]));
    await act(async () => {
      fireEvent.click(screen.getByRole('link', { name: 'Clear filters' }));
    });

    expect(itemTitles()).toEqual(ALL_TITLES);
    expect(screen.getByRole('searchbox')).toHaveValue('');
    await waitFor(() => expect(updates.at(-1)?.queryString).toBe(''));
  });

  it('on a phone the bar is the search and a Filters button; the chips open in its sheet', async () => {
    narrow();
    narrow = () => undefined;
    await renderPage({ issuer: 'udemy' });
    const button = screen.getByRole('button', { name: /^Filters/ });
    const sheet = document.getElementById(button.getAttribute('popovertarget') ?? '');

    expect(button).toHaveTextContent('Filters 1');
    expect(sheet).toHaveAttribute('popover', 'auto');
    expect(screen.queryByRole('list', { name: 'Filter by issuer' })).toBeNull();
    expect(
      within(sheet as HTMLElement).getByRole('list', { name: 'Filter by issuer', hidden: true }),
    ).toBeInTheDocument();
    expect(token('Remove Issuer: Udemy')).toBeVisible();
  });

  it('starts from the address bar when it disagrees with the server render (Back to a cached page)', async () => {
    await renderPage({}, '/certifications?issuer=google');

    expect(itemTitles()).toEqual(GOOGLE_TITLES);
    expect(currentChip()?.textContent).toMatch(/^Google/);
  });
});

describe('focus and announcements when a filter goes away', () => {
  it('removing the last token hands focus to the current chip and says every certificate is back', async () => {
    await renderPage({ skill: 'React.js' });
    const clear = token('Remove Skill: React.js');
    clear.focus();

    fireEvent.click(clear);

    expect(currentChip()?.textContent).toMatch(/^All/);
    expect(document.activeElement).toBe(currentChip());
    expect(status()).toHaveTextContent('Showing all 7 certificates');
  });

  it('with an issuer still chosen, focus lands on that issuer’s token, the one before it', async () => {
    await renderPage({ skill: 'React.js', issuer: 'udemy' });

    fireEvent.click(token('Remove Skill: React.js'));

    expect(document.activeElement).toBe(token('Remove Issuer: Udemy'));
    expect(currentChip()?.textContent).toMatch(/^Udemy/);
    expect(status()).toHaveTextContent('Showing 2 of 7 certificates');
  });

  it('Clear filters in the empty state hands focus to All', async () => {
    await renderPage({ q: 'quantum computing' });

    fireEvent.click(screen.getByRole('link', { name: 'Clear filters' }));

    expect(document.activeElement).toBe(chipNamed(/^All/));
    expect(status()).toHaveTextContent('Showing all 7 certificates');
  });

  it('the All chip announces every certificate; a first load stays quiet', async () => {
    await renderPage();
    expect(status()).toHaveTextContent(/^$/);

    fireEvent.click(chipNamed(/^Google/));
    fireEvent.click(chipNamed(/^All/));

    expect(status()).toHaveTextContent('Showing all 7 certificates');
  });
});

describe('the current chip', () => {
  it('keeps a cue in forced colours, and lifts its count to a tier that reads on its fill', async () => {
    await renderPage({ issuer: 'google' });
    const chip = currentChip() as HTMLElement;
    const count = chip.querySelector('.tabular-nums') as HTMLElement;

    for (const forced of [
      'forced-colors:aria-[current=true]:[forced-color-adjust:none]',
      'forced-colors:aria-[current=true]:bg-[color:Highlight]',
      'forced-colors:aria-[current=true]:text-[color:HighlightText]',
      'forced-colors:aria-[current=true]:border-[color:Highlight]',
    ]) {
      expect(chip.className.split(/\s+/)).toContain(forced);
    }
    expect(count.className.split(/\s+/)).toEqual(
      expect.arrayContaining([
        'text-faint',
        '[[aria-current=true]_&]:text-muted-foreground',
        'forced-colors:[[aria-current=true]_&]:text-[color:HighlightText]',
      ]),
    );
  });
});
