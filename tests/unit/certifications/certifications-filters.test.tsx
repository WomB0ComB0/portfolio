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
 * @file The /certifications filters, which live in the URL (?issuer, ?skill, ?q). On the server
 * render they come from the search params, and today's shared links still resolve (?issuer as a
 * raw issuer string, ?skill as one part of a joined skill string). With JavaScript the chips and
 * the search filter in place and rewrite the URL with history.replaceState, without a round trip.
 *
 * The URL stays the source of truth: when Back or a navigation moves it under the island (Next
 * restoring a cached page rendered for other filters, or a link to the URL the island first
 * rendered), the list follows the URL. next/navigation's useSearchParams is stood in for by a
 * store that the replaceState spy and navigate() report to, as Next's history patch and router do.
 */

import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  loadCertifications: vi.fn(),
  revealInScroller: vi.fn(),
  /** What useSearchParams reports: null until the router first reports, then its last report. */
  search: null as string | null,
  listeners: new Set<() => void>(),
}));

// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
vi.mock('@/lib/sanity/loaders', () => ({ loadCertifications: h.loadCertifications }));
vi.mock('@/app/(routes)/(main)/(professioal)/certifications/_lib/reveal', () => ({
  revealInScroller: h.revealInScroller,
}));
vi.mock('next/navigation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/navigation')>();
  const { useMemo, useSyncExternalStore } = await import('react');
  const subscribe = (listener: () => void): (() => void) => {
    h.listeners.add(listener);
    return () => {
      h.listeners.delete(listener);
    };
  };
  const read = (): string => h.search ?? window.location.search;
  return {
    ...actual,
    useSearchParams: () => {
      const search = useSyncExternalStore(subscribe, read, read);
      return useMemo(() => new URLSearchParams(search), [search]);
    },
  };
});

import CertificationsPage from '@/app/(routes)/(main)/(professioal)/certifications/page';
import {
  ALL_TITLES,
  CERTS,
  chips,
  currentChip,
  renderPage,
  rowsOf,
  rowTitles,
} from './page-fixture';

const GOOGLE_TITLES = ['Build Wireframes', 'BigQuery Basics'];
const UDEMY_TITLES = ['Complete React Developer', 'Udemy TypeScript'];

let replaceState: ReturnType<typeof vi.spyOn>;
/** While set, the router's reports of the page's own replaceState calls wait here. */
let lateReports: string[] | null = null;

/** The Navigation API where a test installs it: jsdom has none. */
const navigationApi = (): EventTarget | undefined =>
  (window as unknown as { navigation?: EventTarget }).navigation;
/**
 * What a browser with the Navigation API does on every history write: replaceState is a
 * 'replace', a navigation's pushState a 'push', Back and Forward a 'traverse'.
 */
const entryChanged = (navigationType: NavigationType = 'replace'): void => {
  navigationApi()?.dispatchEvent(
    Object.assign(new Event('currententrychange'), { navigationType }),
  );
};

/** The router reports a URL to useSearchParams (Next does after its history patch). */
function routerReports(search: string = window.location.search): void {
  h.search = search;
  for (const listener of h.listeners) listener();
}

/** A navigation the island did not make: router.push, a nav link, Back. */
function navigate(url: string): void {
  act(() => {
    window.history.pushState(null, '', url);
    routerReports();
  });
}

const chipNamed = (name: RegExp): HTMLElement => within(chips()).getByRole('link', { name });
const status = (): HTMLElement => screen.getByRole('status');

beforeEach(() => {
  h.loadCertifications.mockReset();
  h.loadCertifications.mockResolvedValue(CERTS);
  h.revealInScroller.mockReset();
  h.search = null;
  lateReports = null;
  const nativeReplaceState = window.history.replaceState.bind(window.history);
  replaceState = vi
    .spyOn(window.history, 'replaceState')
    .mockImplementation((data: unknown, unused: string, url?: string | URL | null) => {
      nativeReplaceState(data, unused, url);
      entryChanged();
      if (lateReports) lateReports.push(window.location.search);
      else routerReports();
    });
});

afterEach(() => {
  cleanup();
  replaceState.mockRestore();
});

describe('filters from the URL, on the server render', () => {
  it('offers All, a chip per family with two or more, and Other, with counts', async () => {
    await renderPage();
    const links = within(chips()).getAllByRole('link');

    // Microsoft and Google tie on two, newest Dec 2024; Microsoft's row is first in Studio order.
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

    expect(rowTitles()).toEqual(GOOGLE_TITLES);
    expect(currentChip()?.textContent).toMatch(/^Google/);
  });

  it('?issuer=Google Cloud Skills Boost lands on Google, as today’s shared links do', async () => {
    await renderPage({ issuer: 'Google Cloud Skills Boost' });

    expect(rowTitles()).toEqual(GOOGLE_TITLES);
    expect(currentChip()?.textContent).toMatch(/^Google 2/);
  });

  it('?issuer=IBM filters to IBM, and the Other chip takes its name', async () => {
    await renderPage({ issuer: 'IBM' });

    expect(rowTitles()).toEqual(['Qiskit Global Summer School 2025']);
    expect(currentChip()?.textContent).toBe('IBM 1 certificate');
    expect(currentChip()).toHaveAttribute('href', '/certifications?issuer=ibm');
  });

  it('?skill filters on one part of a joined skill string and offers a Clear link', async () => {
    await renderPage({ skill: 'react.js', issuer: 'udemy' });

    expect(rowTitles()).toEqual(UDEMY_TITLES);
    const line = screen.getByText('Skill:').closest('p') as HTMLElement;
    expect(line).toHaveTextContent('Skill: React.js · Clear');
    expect(within(line).getByRole('link', { name: 'Clear' })).toHaveAttribute(
      'href',
      '/certifications?issuer=udemy',
    );
  });

  it('?q matches titles, issuers and skills, ignoring case, and fills the search field', async () => {
    await renderPage({ q: 'REDUX' });

    expect(rowTitles()).toEqual(['Complete React Developer']);
    expect(screen.getByRole('searchbox', { name: 'Search certificates' })).toHaveValue('REDUX');
  });

  it('shows a designed empty state with a Clear link when nothing matches', async () => {
    await renderPage({ q: 'quantum computing' });
    const empty = screen
      .getByRole('heading', { name: 'No certificates match' })
      .closest('[data-state]');

    expect(rowsOf()).toEqual([]);
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
    // Without its name the form would submit no ?q (CodeRabbit on #613).
    expect(screen.getByRole('searchbox')).toHaveAttribute('name', 'q');
    expect(form.querySelector('input[type="hidden"][name="issuer"]')).toHaveValue('udemy');
    expect(form.querySelector('input[type="hidden"][name="skill"]')).toHaveValue('React.js');
  });
});

describe('filtering in place with JavaScript', () => {
  it('a chip filters without a round trip and rewrites the URL', async () => {
    await renderPage();

    const prevented = !fireEvent.click(chipNamed(/^Udemy/));

    expect(prevented).toBe(true);
    expect(rowTitles()).toEqual(UDEMY_TITLES);
    expect(currentChip()?.textContent).toMatch(/^Udemy/);
    expect(replaceState).toHaveBeenLastCalledWith(null, '', '/certifications?issuer=udemy');
    expect(status()).toHaveTextContent('Showing 2 of 7 certificates');
  });

  it('leaves a modified click (a new tab) to the browser', async () => {
    await renderPage();

    const prevented = !fireEvent.click(chipNamed(/^Udemy/), { ctrlKey: true });

    expect(prevented).toBe(false);
    expect(rowTitles()).toEqual(ALL_TITLES);
    expect(replaceState).not.toHaveBeenCalled();
  });

  it('the search filters as you type and writes ?q once typing stops', async () => {
    await renderPage({ issuer: 'udemy' });

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'typescript' } });

    await waitFor(() => expect(rowTitles()).toEqual(['Udemy TypeScript']));
    await waitFor(() =>
      expect(replaceState).toHaveBeenLastCalledWith(
        null,
        '',
        '/certifications?issuer=udemy&q=typescript',
      ),
    );
  });

  it('Clear removes the skill, and Clear filters removes everything', async () => {
    await renderPage({ skill: 'React.js', issuer: 'udemy' });

    fireEvent.click(screen.getByRole('link', { name: 'Clear' }));
    expect(screen.queryByText('Skill:')).toBeNull();
    expect(replaceState).toHaveBeenLastCalledWith(null, '', '/certifications?issuer=udemy');

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'nothing like this' } });
    await waitFor(() => expect(rowsOf()).toEqual([]));
    await act(async () => {
      fireEvent.click(screen.getByRole('link', { name: 'Clear filters' }));
    });

    expect(rowTitles()).toEqual(ALL_TITLES);
    expect(screen.getByRole('searchbox')).toHaveValue('');
    expect(replaceState).toHaveBeenLastCalledWith(null, '', '/certifications');
  });

  it('scrolls the current chip into view inside the toolbar (a phone’s sideways row)', async () => {
    await renderPage({ issuer: 'IBM' });
    const toolbar = document.querySelector('[data-ledger-part="toolbar"]');

    expect(h.revealInScroller).toHaveBeenCalledWith(toolbar, currentChip());

    h.revealInScroller.mockClear();
    fireEvent.click(chipNamed(/^Google/));
    expect(h.revealInScroller).toHaveBeenLastCalledWith(toolbar, chipNamed(/^Google/));
  });
});

describe('the URL is the source of truth', () => {
  it('starts from the address bar when it disagrees with the server render (Back to a cached page)', async () => {
    // Next restored the payload rendered with no filter; the URL says Google.
    await renderPage({}, '/certifications?issuer=google');

    expect(rowTitles()).toEqual(GOOGLE_TITLES);
    expect(currentChip()?.textContent).toMatch(/^Google/);
  });

  it('starts over when a navigation lands on the URL it first rendered', async () => {
    await renderPage();
    fireEvent.click(chipNamed(/^Google/));
    expect(rowTitles()).toEqual(GOOGLE_TITLES);

    navigate('/certifications');

    expect(rowTitles()).toEqual(ALL_TITLES);
    expect(currentChip()?.textContent).toMatch(/^All/);
  });

  it('starts over on a navigation to its first URL even when the router never reported the chip', async () => {
    // A quick router.push after a chip: React can fold Next's report of the chip's URL into the
    // navigation, so the search params read '' before and after. The server still renders again.
    const { rerender } = await renderPage();
    routerReports();
    lateReports = [];
    fireEvent.click(chipNamed(/^Google/));
    expect(rowTitles()).toEqual(GOOGLE_TITLES);
    lateReports = null;

    window.history.pushState(null, '', '/certifications');
    rerender(await CertificationsPage({ searchParams: Promise.resolve({}) }));

    expect(rowTitles()).toEqual(ALL_TITLES);
    expect(currentChip()?.textContent).toMatch(/^All/);
  });

  it('keeps a search still being typed when the server renders the same URL again', async () => {
    const { rerender } = await renderPage({ issuer: 'udemy' });
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'type' } });

    rerender(await CertificationsPage({ searchParams: Promise.resolve({ issuer: 'udemy' }) }));

    expect(screen.getByRole('searchbox')).toHaveValue('type');
    await waitFor(() => expect(rowTitles()).toEqual(['Udemy TypeScript']));
  });

  it('brings back the filters it had cleared when a navigation asks for them again', async () => {
    await renderPage({ issuer: 'google', q: 'big' });
    fireEvent.click(chipNamed(/^All/));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } });
    fireEvent.submit(screen.getByRole('searchbox'));
    expect(rowTitles()).toEqual(ALL_TITLES);

    navigate('/certifications?issuer=google&q=big');

    expect(rowTitles()).toEqual(['BigQuery Basics']);
    expect(currentChip()?.textContent).toMatch(/^Google/);
    expect(screen.getByRole('searchbox')).toHaveValue('big');
  });

  it('drops a search still waiting to be written when a navigation moves the URL', async () => {
    await renderPage();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'typescript' } });

    navigate('/certifications?issuer=udemy');
    await act(() => new Promise((resolve) => setTimeout(resolve, 400)));

    expect(window.location.search).toBe('?issuer=udemy');
    expect(screen.getByRole('searchbox')).toHaveValue('');
    expect(rowTitles()).toEqual(UDEMY_TITLES);
  });

  it('never starts over on its own writes, even when the router reports them late', async () => {
    await renderPage();
    routerReports();
    lateReports = [];

    fireEvent.click(chipNamed(/^Google/));
    fireEvent.click(chipNamed(/^Udemy/));
    const [first, second] = lateReports;
    lateReports = null;
    act(() => routerReports(first));

    expect(rowTitles()).toEqual(UDEMY_TITLES);
    expect(currentChip()?.textContent).toMatch(/^Udemy/);

    act(() => routerReports(second));
    expect(rowTitles()).toEqual(UDEMY_TITLES);
  });
});

describe('the URL is the source of truth, where the browser has the Navigation API', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'navigation', { value: new EventTarget(), configurable: true });
  });
  afterEach(() => {
    Reflect.deleteProperty(window, 'navigation');
  });

  it('starts over on a navigation in the same tick as a chip, which neither the router nor the server reports', async () => {
    // A script's router.push right after a click: Next folds its report of the chip's URL into
    // the navigation and serves the page from its cache, so only the history entry changes.
    await renderPage();
    routerReports();
    lateReports = [];
    fireEvent.click(chipNamed(/^Google/));
    lateReports = null;

    act(() => {
      window.history.pushState(null, '', '/certifications');
      entryChanged('push');
    });

    expect(rowTitles()).toEqual(ALL_TITLES);
    expect(currentChip()?.textContent).toMatch(/^All/);
  });

  // CodeRabbit on #613: the navigation lands on the URL the island already stands for, so only
  // the kind of history change says it was a navigation; the pending ?q must not come back.
  it('drops a search still waiting to be written when a navigation lands on the same URL', async () => {
    await renderPage();
    routerReports();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'typescript' } });

    act(() => {
      window.history.pushState(null, '', '/certifications');
      entryChanged('push');
    });
    await act(() => new Promise((resolve) => setTimeout(resolve, 400)));

    expect(window.location.search).toBe('');
    expect(screen.getByRole('searchbox')).toHaveValue('');
    expect(rowTitles()).toEqual(ALL_TITLES);
  });

  // CodeRabbit on #613: Google and Udemy are both waiting for the router's report when a
  // navigation goes to Google's URL; that is a navigation, not the island's own write.
  it('follows a navigation to a URL it wrote earlier and has not heard back about', async () => {
    await renderPage();
    routerReports();
    lateReports = [];
    fireEvent.click(chipNamed(/^Google/));
    fireEvent.click(chipNamed(/^Udemy/));
    lateReports = null;

    act(() => {
      window.history.pushState(null, '', '/certifications?issuer=google');
      entryChanged('push');
    });
    expect(currentChip()?.textContent).toMatch(/^Google/);
    expect(rowTitles()).toEqual(GOOGLE_TITLES);

    act(() => routerReports('?issuer=google'));
    expect(rowTitles()).toEqual(GOOGLE_TITLES);
  });

  it('follows Back to a URL it wrote itself', async () => {
    await renderPage();
    routerReports();
    fireEvent.click(chipNamed(/^Google/));
    act(() => {
      window.history.pushState(null, '', '/certifications?issuer=udemy');
      entryChanged('push');
      routerReports();
    });

    act(() => {
      window.history.replaceState(null, '', '/certifications?issuer=google');
      // replaceState is spied to report 'replace'; a real Back is a traverse.
      entryChanged('traverse');
    });

    expect(currentChip()?.textContent).toMatch(/^Google/);
    expect(rowTitles()).toEqual(GOOGLE_TITLES);
  });

  it('still never starts over on its own writes reported late', async () => {
    await renderPage();
    routerReports();
    lateReports = [];

    fireEvent.click(chipNamed(/^Google/));
    fireEvent.click(chipNamed(/^Udemy/));
    const [first, second] = lateReports;
    lateReports = null;
    act(() => routerReports(first));
    expect(rowTitles()).toEqual(UDEMY_TITLES);

    act(() => routerReports(second));
    expect(rowTitles()).toEqual(UDEMY_TITLES);
  });

  it('ignores the history entry of a navigation away from the page', async () => {
    await renderPage({ issuer: 'google' });

    act(() => {
      window.history.pushState(null, '', '/projects');
      entryChanged();
    });

    expect(rowTitles()).toEqual(GOOGLE_TITLES);
  });
});

describe('focus and announcements when a filter goes away', () => {
  it('Clear on the skill line hands focus to the current chip and says every certificate is back', async () => {
    await renderPage({ skill: 'React.js' });
    const clear = screen.getByRole('link', { name: 'Clear' });
    clear.focus();

    fireEvent.click(clear);

    expect(currentChip()?.textContent).toMatch(/^All/);
    expect(document.activeElement).toBe(currentChip());
    expect(status()).toHaveTextContent('Showing all 7 certificates');
  });

  it('with an issuer still chosen, focus lands on that issuer’s chip', async () => {
    await renderPage({ skill: 'React.js', issuer: 'udemy' });

    fireEvent.click(screen.getByRole('link', { name: 'Clear' }));

    expect(document.activeElement).toBe(chipNamed(/^Udemy/));
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

    // Forced colours repaint the brand fill and border, so the current chip takes the system's
    // selected colours instead of looking like every other chip.
    for (const forced of [
      'forced-colors:aria-[current=true]:[forced-color-adjust:none]',
      'forced-colors:aria-[current=true]:bg-[color:Highlight]',
      'forced-colors:aria-[current=true]:text-[color:HighlightText]',
      'forced-colors:aria-[current=true]:border-[color:Highlight]',
    ]) {
      expect(chip.className.split(/\s+/)).toContain(forced);
    }
    // text-faint on the brand-subtle fill is 4.27:1; muted is 5.98:1 (token-contrast.test.ts).
    expect(count.className.split(/\s+/)).toEqual(
      expect.arrayContaining([
        'text-faint',
        '[[aria-current=true]_&]:text-muted-foreground',
        'forced-colors:[[aria-current=true]_&]:text-[color:HighlightText]',
      ]),
    );
  });
});
