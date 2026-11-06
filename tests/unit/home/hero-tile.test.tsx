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
 * @file The home hero as the server sends it: one h1, an avatar that loads first, the ways to get
 * in touch with their spoken names, and the current role line, which streams in behind its own
 * Suspense inside a box that keeps its height (and stays empty when there is no role). Also the
 * "Jump to…" palette button: the shell's shortcut hint and a click that opens the palette.
 *
 * The location, the positioning line and the contact links come from the Sanity site settings,
 * each falling back to today's built-in value when missing, invalid or failing, and none of them
 * waits for Sanity before the first flush. A new server starts with nothing cached
 * (instrumentation's register() asks Sanity nothing, since every route waits for it): its first
 * flush is the built-in copy, with the tagline's box as tall as Studio's longest tagline at the
 * tile's width (five lines on a phone, three from 24rem), so the owner's longer tagline streaming
 * in moves nothing. The real Sanity loaders run
 * against a mocked client, so what Sanity answers is decoded as in production; only Sentry, its
 * entry points and the env are mocked too, and the hero's peek at the cached settings is a spy
 * that runs the real one.
 *
 * The hero is rendered with react-dom/static's prerender, which waits for the async parts as the
 * server does, then parsed into jsdom to be queried. renderToString gives the first flush (every
 * Suspense fallback). jsdom applies no CSS, so sr-only words count in accessible names.
 */

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { makeExperience } from '@tests/fixtures/sanity-docs';
import type { AnchorHTMLAttributes, ReactElement, ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { prerender } from 'react-dom/static';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  toggle: vi.fn(),
  loadCurrentRoles: vi.fn(),
  sanityFetchWithToken: vi.fn(),
  captureException: vi.fn(),
  peekSiteSettings: vi.fn(),
}));

vi.mock('kbar', async (importOriginal) => ({
  ...(await importOriginal<typeof import('kbar')>()),
  useKBar: () => ({ query: { toggle: h.toggle } }),
}));

vi.mock('@/app/_components/home/data/loaders', () => ({
  loadCurrentRoles: h.loadCurrentRoles,
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: h.captureException,
  captureRequestError: vi.fn(),
}));
vi.mock('@/lib/sanity/client', () => ({ sanityFetchWithToken: h.sanityFetchWithToken }));
// The Sentry entry points instrumentation's register() loads; their own tests cover them.
vi.mock('../../../instrumentation-server', () => ({}));
vi.mock('../../../instrumentation-edge', () => ({}));
// t3-env validates every production variable on import.
vi.mock('@/env', () => {
  const env = {};
  return { env, default: env };
});
vi.mock('@/lib/sanity/loaders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/sanity/loaders')>();
  h.peekSiteSettings.mockImplementation(actual.peekSiteSettings);
  return { ...actual, peekSiteSettings: h.peekSiteSettings };
});

vi.mock('next/link', () => ({
  default: ({
    href,
    prefetch,
    children,
    ...rest
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    prefetch?: boolean | null;
    children?: ReactNode;
  }) => (
    <a {...rest} href={href} data-prefetch={String(prefetch)}>
      {children}
    </a>
  ),
}));

import type { CurrentRoles } from '@/app/_components/home/data/selectors';
import { SERVER_TILE_DEADLINE_MS, type TileResult } from '@/app/_components/home/data/tile-result';
import {
  HERO_FALLBACK_COPY,
  HERO_LOCATION,
  HERO_POSITIONING,
  type HeroCopy,
  HeroRoleLine,
  HeroTile,
  heroCopyOf,
  LINKEDIN_PROFILE_URL,
  loadHeroCopy,
  TAGLINE_SLOT_RESERVED_CLASS,
} from '@/app/_components/home/tiles/hero-tile';
import { PALETTE_HINT_LABEL, PaletteHint } from '@/app/_components/home/tiles/palette-hint';
import { GITHUB_PROFILE_URL } from '@/app/_components/home/tiles/tile-states';
import { app } from '@/constants';
import { register } from '@/instrumentation';
import { resetApiReportCooldowns } from '@/lib/observability/report';
import { resetSanityLoaderCaches, SANITY_CACHE_TTL_MS } from '@/lib/sanity/loaders';
import { SITE_LOCATION_MAX_LENGTH, SITE_TAGLINE_MAX_LENGTH } from '@/sanity/site-settings-rules';

const FOUNDER = makeExperience({
  position: 'Founder & CEO',
  company: 'ResQ Systems, Inc.',
  current: true,
  startDate: '2026-03-01',
});

const ROLES: TileResult<CurrentRoles> = {
  status: 'ok',
  data: { roles: [FOUNDER, makeExperience({ current: true })], total: 5 },
  stale: false,
};

/** The settings document as Sanity answers it (synthetic values). */
const SETTINGS = {
  _id: 'siteSettings',
  _type: 'siteSettings',
  location: 'Brooklyn, NY',
  tagline: 'Shipping fraud detection and the web around it.',
  email: 'hello@example.dev',
  githubUrl: 'https://github.com/example',
  linkedinUrl: 'https://www.linkedin.com/in/example/',
} as const;

const SETTINGS_COPY: HeroCopy = {
  location: SETTINGS.location,
  tagline: SETTINGS.tagline,
  email: SETTINGS.email,
  githubUrl: SETTINGS.githubUrl,
  linkedinUrl: SETTINGS.linkedinUrl,
};

const T0 = new Date('2026-11-06T12:00:00Z').getTime();

/** A Sanity request that never answers. */
const pending = (): Promise<never> => new Promise(() => {});

/** The hero's HTML once every Suspense boundary has resolved, as the server streams it. */
async function renderHeroHtml(): Promise<void> {
  const { prelude } = await prerender(<HeroTile />);
  document.body.innerHTML = await new Response(prelude).text();
}

/** The hero's first flush: every Suspense boundary still shows its fallback. */
function renderFirstFlush(): void {
  document.body.innerHTML = renderToString(<HeroTile />);
}

/** The box that holds the role line: the h1's next sibling. */
const roleSlot = (): HTMLElement => {
  const slot = screen.getByRole('heading', { level: 1 }).nextElementSibling;
  if (!(slot instanceof HTMLElement)) throw new Error('no role slot after the h1');
  return slot;
};

/** The box around the tagline. */
const taglineSlot = (): HTMLElement => {
  const slot = document.querySelector('[data-hero-tagline-slot]');
  if (!(slot instanceof HTMLElement)) throw new Error('no tagline slot');
  return slot;
};

/**
 * A tagline about three times the built-in one (107 characters): three lines from a 24rem tile,
 * more on a phone.
 */
const LONG_TAGLINE =
  'Shipping fraud detection, payments infrastructure and the web around both, from first sketch to production.';

/** The word or words beside the avatar. */
const locationText = (): string | null | undefined =>
  screen.getByRole('img').parentElement?.querySelector('p')?.textContent;

/** Where each contact link leads, by its spoken name. */
const contactHrefs = (): Record<string, string | null> => ({
  email: screen.getByRole('link', { name: 'Email me' }).getAttribute('href'),
  github: screen.getByRole('link', { name: 'GitHub (opens in a new tab)' }).getAttribute('href'),
  linkedin: screen
    .getByRole('link', { name: 'LinkedIn (opens in a new tab)' })
    .getAttribute('href'),
});

const hrefsOf = (copy: HeroCopy): Record<string, string> => ({
  email: `mailto:${copy.email}`,
  github: copy.githubUrl,
  linkedin: copy.linkedinUrl,
});

/** The hero's copy, as the page shows it. */
const expectCopy = (copy: HeroCopy): void => {
  expect(locationText()).toBe(copy.location);
  expect(screen.getByText(copy.tagline).tagName).toBe('P');
  expect(contactHrefs()).toEqual(hrefsOf(copy));
};

const expectHeroReport = (level: 'error' | 'warning'): void => {
  expect(h.captureException).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ level, tags: { 'api.context': 'home hero tile' } }),
  );
};

const setPlatform = (platform: string): void => {
  Object.defineProperty(navigator, 'platform', { value: platform, configurable: true });
};

beforeEach(() => {
  h.loadCurrentRoles.mockResolvedValue(ROLES);
  h.sanityFetchWithToken.mockReset();
  h.sanityFetchWithToken.mockResolvedValue(null);
  h.captureException.mockReset();
  resetSanityLoaderCaches();
  resetApiReportCooldowns();
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  vi.clearAllMocks();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  Reflect.deleteProperty(navigator, 'platform');
});

describe('HeroTile', () => {
  it('has exactly one h1, named Mike Odnis, in the foreground colour', async () => {
    await renderHeroHtml();
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveAccessibleName('Mike Odnis');
    expect(headings[0]).toHaveAttribute('id', 'home-title');
    expect(headings[0]).toHaveClass('text-foreground');
    expect(headings[0]?.className).not.toMatch(/text-brand|text-primary/);
  });

  it('loads the avatar first: eager, high fetch priority, drawn at 96 px', async () => {
    await renderHeroHtml();
    const avatar = screen.getByRole('img', {
      name: "Mike Odnis's avatar: a painting of a scholar writing at his desk",
    });
    expect(avatar).toHaveAttribute('loading', 'eager');
    expect(avatar).toHaveAttribute('fetchpriority', 'high');
    expect(avatar).toHaveAttribute('sizes', '96px');
    expect(avatar).toHaveAttribute('width', '96');
    expect(avatar).toHaveAttribute('height', '96');
  });

  it('lists the contact links with their spoken names, in a list and not a nav', async () => {
    await renderHeroHtml();
    const list = screen.getByRole('list');
    expect(within(list).getAllByRole('link')).toHaveLength(4);
    expect(screen.queryByRole('navigation')).toBeNull();

    expect(screen.getByRole('link', { name: 'Email me' })).toHaveAttribute(
      'href',
      `mailto:${app.email}`,
    );
    for (const [name, href] of [
      ['GitHub (opens in a new tab)', 'https://github.com/WomB0ComB0'],
      ['LinkedIn (opens in a new tab)', 'https://www.linkedin.com/in/mikeodnis/'],
    ] as const) {
      const link = screen.getByRole('link', { name });
      expect(link).toHaveAttribute('href', href);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
    const resume = screen.getByRole('link', { name: 'Résumé' });
    expect(resume).toHaveAttribute('href', '/resume');
    expect(resume).toHaveAttribute('data-prefetch', 'false');
    expect(resume).not.toHaveAttribute('target');
  });

  it('gives every link a 44 px tall target', async () => {
    await renderHeroHtml();
    for (const link of screen.getAllByRole('link')) expect(link).toHaveClass('h-11');
    expect(screen.getByRole('button', { name: PALETTE_HINT_LABEL })).toHaveClass('h-11');
  });

  it('shows the positioning line', async () => {
    await renderHeroHtml();
    expect(HERO_POSITIONING).toBe('Building web software end to end.');
    expect(screen.getByText(HERO_POSITIONING).tagName).toBe('P');
  });

  it('streams in the first current role beside the word Now and a still amber dot', async () => {
    await renderHeroHtml();
    const slot = roleSlot();
    expect(within(slot).getByText('Founder & CEO at ResQ Systems, Inc.')).toBeInTheDocument();
    expect(within(slot).getByText('Now')).toHaveClass('text-ongoing');
    const dot = slot.querySelector('[data-status-dot]');
    expect(dot).toHaveAttribute('data-tone', 'ongoing');
    expect(dot?.className).not.toMatch(/animate/);
  });

  it.each([
    ['empty', { status: 'empty' }],
    ['error', { status: 'error' }],
  ] as const)(
    'renders no role line when roles are %s, keeping the reserved box',
    async (_, result) => {
      h.loadCurrentRoles.mockResolvedValue(result);
      await renderHeroHtml();
      const slot = roleSlot();
      expect(slot).toHaveClass('min-h-[3em]', '@xl:min-h-[1.5em]');
      expect(slot.textContent).toBe('');
      expect(slot.querySelector('p, [aria-hidden]')).toBeNull();
    },
  );

  it('puts the h1 in the first flush and a placeholder bar in the role box', () => {
    h.loadCurrentRoles.mockReturnValue(pending());
    renderFirstFlush();
    expect(screen.getByRole('heading', { level: 1, name: 'Mike Odnis' })).toBeInTheDocument();
    const bar = roleSlot().querySelector('span[aria-hidden="true"]');
    expect(bar).toHaveClass('h-[1.5em]', 'bg-surface-3');
  });
});

describe('HeroTile with the site settings', () => {
  it('shows the location, the tagline and the contact links from the settings', async () => {
    h.sanityFetchWithToken.mockResolvedValue(SETTINGS);
    await renderHeroHtml();
    expectCopy(SETTINGS_COPY);
    expect(screen.queryByText(HERO_POSITIONING)).toBeNull();
    expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName('Mike Odnis');
    expect(h.captureException).not.toHaveBeenCalled();
  });

  it("shows today's copy when there is no settings document", async () => {
    await renderHeroHtml();
    expect(HERO_LOCATION).toBe('New York, NY');
    expectCopy(HERO_FALLBACK_COPY);
    expect(h.captureException).not.toHaveBeenCalled();
  });

  it('falls back for each invalid field alone, keeping the valid ones', async () => {
    h.sanityFetchWithToken.mockResolvedValue({
      ...SETTINGS,
      email: 'hello@example.dev?cc=someone@example.org',
      githubUrl: 'http://github.com/example',
      linkedinUrl: 'javascript:alert(1)',
    });
    await renderHeroHtml();
    expectCopy({
      ...SETTINGS_COPY,
      email: app.email,
      githubUrl: GITHUB_PROFILE_URL,
      linkedinUrl: LINKEDIN_PROFILE_URL,
    });
  });

  // A valid location or tagline can be one word Studio's limits allow; at 320 px it would run out
  // of the tile instead of wrapping.
  it('breaks a long unbroken location or tagline inside the tile instead of overflowing it', async () => {
    const location = 'X'.repeat(SITE_LOCATION_MAX_LENGTH);
    const tagline = 'x'.repeat(SITE_TAGLINE_MAX_LENGTH);
    h.sanityFetchWithToken.mockResolvedValue({ ...SETTINGS, location, tagline });
    await renderHeroHtml();
    expect(locationText()).toBe(location);
    expect(screen.getByText(location)).toHaveClass('min-w-0', 'wrap-break-word');
    expect(screen.getByText(tagline)).toHaveClass('wrap-break-word');
  });

  it("sends a literal '%' in the address as %25, so the mail client gets the address as set", async () => {
    h.sanityFetchWithToken.mockResolvedValue({ ...SETTINGS, email: 'first%2Blast@example.dev' });
    await renderHeroHtml();
    const href = contactHrefs().email ?? '';
    expect(href).toBe('mailto:first%252Blast@example.dev');
    // What a mail client decodes the link to: the configured mailbox, not first+last@.
    expect(decodeURIComponent(href)).toBe('mailto:first%2Blast@example.dev');
  });

  it("renders today's copy and reports the hero tile when Sanity fails with nothing cached", async () => {
    h.sanityFetchWithToken.mockRejectedValue(new Error('Sanity answered 502 Bad Gateway'));
    await renderHeroHtml();
    expectCopy(HERO_FALLBACK_COPY);
    expectHeroReport('error');
  });

  it('puts the h1, the copy and all four links in the first flush while the settings load', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    h.sanityFetchWithToken.mockReturnValue(pending());
    renderFirstFlush();
    expect(screen.getByRole('heading', { level: 1, name: 'Mike Odnis' })).toBeInTheDocument();
    expect(within(screen.getByRole('list')).getAllByRole('link')).toHaveLength(4);
    expectCopy(HERO_FALLBACK_COPY);
  });

  it('fills the first flush from the settings last loaded, so a warm server swaps in no change', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(T0);
    h.sanityFetchWithToken.mockResolvedValueOnce(SETTINGS);
    await loadHeroCopy();

    vi.setSystemTime(T0 + SANITY_CACHE_TTL_MS + 1);
    h.sanityFetchWithToken.mockReturnValue(pending());
    renderFirstFlush();

    expectCopy(SETTINGS_COPY);
    // The reload is under way: the next request gets what it answers.
    await vi.waitFor(() => expect(h.sanityFetchWithToken).toHaveBeenCalledTimes(2));
  });

  it("renders today's copy, and reports, when reading the cached settings throws", () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    h.peekSiteSettings.mockImplementationOnce(() => {
      throw new Error('cache unreadable');
    });
    h.sanityFetchWithToken.mockReturnValue(pending());
    renderFirstFlush();
    expectCopy(HERO_FALLBACK_COPY);
    expectHeroReport('error');
    // Nothing known to match what streams in: the tagline's box is reserved.
    expect(taglineSlot().className).toBe(TAGLINE_SLOT_RESERVED_CLASS);
  });
});

describe('HeroTile on a server with nothing cached yet', () => {
  it('reserves tagline lines in the first flush, at the tagline’s own type size', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    h.sanityFetchWithToken.mockReturnValue(pending());

    renderFirstFlush();

    expect(taglineSlot().className).toBe(TAGLINE_SLOT_RESERVED_CLASS);
    expect(taglineSlot()).toHaveClass('text-body', '@xl:text-title');
    expect(taglineSlot()).toHaveTextContent(HERO_POSITIONING);
    expect(screen.getByText(HERO_POSITIONING)).toHaveClass('text-body', '@xl:text-title');
  });

  // Measured in Chromium with Geist at 16/26 px: 120-character taglines took five lines at the
  // 238 px of text a 320 px phone's hero has, four at 375 px (293 px) and up to 360 px, three
  // from a 24rem tile. One box three lines tall let a phone's hero grow by one or two lines,
  // pushing the links and the tiles below them down, when the owner's tagline streamed in.
  it('reserves as many lines as Studio’s longest tagline takes at each tile width', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    h.sanityFetchWithToken.mockReturnValue(pending());

    renderFirstFlush();

    const reserved = taglineSlot()
      .className.split(' ')
      .filter((name) => name.includes('min-h-'));
    expect(reserved).toEqual(['min-h-[5lh]', '@2xs:min-h-[4lh]', '@sm:min-h-[3lh]']);
    // The measurement holds for Studio's limit: raising it means measuring again.
    expect(SITE_TAGLINE_MAX_LENGTH).toBe(120);
  });

  it('streams the owner’s copy into that box, so a longer tagline moves nothing below it', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    h.sanityFetchWithToken.mockReturnValue(pending());
    renderFirstFlush();
    expectCopy(HERO_FALLBACK_COPY);
    const firstFlushBox = taglineSlot().className;

    resetSanityLoaderCaches();
    vi.useRealTimers();
    h.sanityFetchWithToken.mockResolvedValue({ ...SETTINGS, tagline: LONG_TAGLINE });
    await renderHeroHtml();

    expect(LONG_TAGLINE.length).toBeGreaterThan(3 * HERO_POSITIONING.length);
    expectCopy({ ...SETTINGS_COPY, tagline: LONG_TAGLINE });
    expect(taglineSlot().className).toBe(firstFlushBox);
    expect(firstFlushBox).toBe(TAGLINE_SLOT_RESERVED_CLASS);
  });

  it('reserves nothing once the settings are cached: the first flush is the streamed twin', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(T0);
    h.sanityFetchWithToken.mockResolvedValueOnce({ ...SETTINGS, tagline: LONG_TAGLINE });
    await loadHeroCopy();

    renderFirstFlush();

    expect(taglineSlot()).toHaveTextContent(LONG_TAGLINE);
    expect(taglineSlot().className).toBe('');
  });

  // register() is awaited before a new instance serves any route, the home page or not: a Sanity
  // round trip there would hold up every cold start for the hero's sake.
  it('is how a new server starts: instrumentation’s register() asks Sanity nothing', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');

    await register();

    expect(h.sanityFetchWithToken).not.toHaveBeenCalled();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    h.sanityFetchWithToken.mockReturnValue(pending());
    renderFirstFlush();
    expectCopy(HERO_FALLBACK_COPY);
    expect(taglineSlot().className).toBe(TAGLINE_SLOT_RESERVED_CLASS);
  });
});

describe('loadHeroCopy', () => {
  it('answers the settings last loaded, and warns, when a reload outlasts the tile deadline', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(T0);
    h.sanityFetchWithToken.mockResolvedValueOnce(SETTINGS);
    expect(await loadHeroCopy()).toEqual(SETTINGS_COPY);

    vi.setSystemTime(T0 + SANITY_CACHE_TTL_MS + 1);
    h.sanityFetchWithToken.mockReturnValue(pending());
    const copy = loadHeroCopy();
    await vi.advanceTimersByTimeAsync(SERVER_TILE_DEADLINE_MS);

    expect(await copy).toEqual(SETTINGS_COPY);
    expectHeroReport('warning');
  });
});

describe('heroCopyOf', () => {
  it("takes each field the settings have, and today's value for each they lack", () => {
    expect(heroCopyOf({ _id: 'siteSettings', _type: 'siteSettings', tagline: 'Hi.' })).toEqual({
      ...HERO_FALLBACK_COPY,
      tagline: 'Hi.',
    });
    expect(heroCopyOf(null)).toEqual(HERO_FALLBACK_COPY);
    expect(heroCopyOf(undefined)).toEqual(HERO_FALLBACK_COPY);
  });

  it("is today's hero without settings", () => {
    expect(HERO_FALLBACK_COPY).toEqual({
      location: 'New York, NY',
      tagline: 'Building web software end to end.',
      email: app.email,
      githubUrl: 'https://github.com/WomB0ComB0',
      linkedinUrl: 'https://www.linkedin.com/in/mikeodnis/',
    });
  });
});

describe('HeroRoleLine', () => {
  it('reads "{position} at {company}" from the first role in Studio order', async () => {
    render((await HeroRoleLine()) as ReactElement);
    expect(screen.getByText('Founder & CEO at ResQ Systems, Inc.')).toBeInTheDocument();
  });

  it('renders nothing without a current role', async () => {
    h.loadCurrentRoles.mockResolvedValue({ status: 'empty' });
    expect(await HeroRoleLine()).toBeNull();
    h.loadCurrentRoles.mockResolvedValue({ status: 'error' });
    expect(await HeroRoleLine()).toBeNull();
  });
});

describe('PaletteHint', () => {
  it('prints the shell hint ⌘K in the server HTML, like the rail and phone bar', () => {
    const html = renderToString(<PaletteHint />);
    expect(html).toContain('⌘K');
    expect(html).toContain('aria-keyshortcuts="Meta+K"');
  });

  it('switches to Ctrl K after hydrating on a non-Apple platform', () => {
    setPlatform('Linux x86_64');
    render(<PaletteHint />);
    const button = screen.getByRole('button', { name: PALETTE_HINT_LABEL });
    expect(button).toHaveTextContent('Ctrl K');
    expect(button).toHaveAttribute('aria-keyshortcuts', 'Control+K');
  });

  it('keeps ⌘K on Apple platforms and hides the hint on touch screens', () => {
    setPlatform('MacIntel');
    render(<PaletteHint />);
    const button = screen.getByRole('button', { name: PALETTE_HINT_LABEL });
    const hint = button.querySelector('kbd');
    expect(hint).toHaveTextContent('⌘K');
    expect(hint).toHaveClass('pointer-coarse:hidden');
    expect(button).toHaveAttribute('aria-keyshortcuts', 'Meta+K');
  });

  it('toggles the command palette on click', () => {
    render(<PaletteHint />);
    fireEvent.click(screen.getByRole('button', { name: PALETTE_HINT_LABEL }));
    expect(h.toggle).toHaveBeenCalledTimes(1);
  });
});
