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
 * @file The home hero as the server sends it: the avatar beside the one h1, the role line, the
 * positioning line and the ways to get in touch with their spoken names. Nothing else: no 'Now'
 * chip, no eyebrow, no 'Jump to…' button (the rail and the phone bar open the palette).
 *
 * The role line is '{position}, {company} · {location}': the first current role, its company
 * without ', Inc.', then the location from the site settings, muted. It streams in behind its own
 * Suspense inside a box that keeps its height, is clamped to the lines that box reserves, and
 * shows either part alone without the other (nothing without both).
 *
 * The positioning line and the contact links come from the Sanity site settings, each falling
 * back to today's built-in value when missing, invalid or failing. The location has no built-in
 * value (owner decision: 'Clear the field in Studio to hide it'): a document without one, or a
 * failure with nothing cached, shows the role alone; a failure after a good load shows the last
 * good settings, so a location the owner cleared never comes back. The tagline and the links
 * never wait for Sanity before the first flush. A new server starts with nothing cached
 * (instrumentation's register() asks Sanity nothing, since every route waits for it): its first
 * flush is the built-in copy, with the tagline's box as tall as Studio's longest tagline at the
 * tile's width (five lines on a phone, three from 24rem), so the owner's longer tagline streaming
 * in moves nothing. The real Sanity loaders run against a mocked client, so what Sanity answers is
 * decoded as in production; only Sentry, its entry points and the env are mocked too, and the
 * hero's peek at the cached settings is a spy that runs the real one.
 *
 * The hero is rendered with react-dom/static's prerender, which waits for the async parts as the
 * server does, then parsed into jsdom to be queried. renderToString gives the first flush (every
 * Suspense fallback). jsdom applies no CSS, so sr-only words count in accessible names.
 */

import { cleanup, render, screen, within } from '@testing-library/react';
import { makeExperience } from '@tests/fixtures/sanity-docs';
import type { AnchorHTMLAttributes, ReactElement, ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { prerender } from 'react-dom/static';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  loadCurrentRoles: vi.fn(),
  sanityFetchWithToken: vi.fn(),
  captureException: vi.fn(),
  peekSiteSettings: vi.fn(),
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
  HERO_POSITIONING,
  type HeroCopy,
  HeroRoleLine,
  HeroTile,
  heroCopyOf,
  LINKEDIN_PROFILE_URL,
  loadHeroCopy,
  TAGLINE_SLOT_RESERVED_CLASS,
} from '@/app/_components/home/tiles/hero-tile';
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

/** The box that holds the role line. */
const roleSlot = (): HTMLElement => {
  const slot = document.querySelector('[data-hero-role-slot]');
  if (!(slot instanceof HTMLElement)) throw new Error('no role slot');
  return slot;
};

/** The box around the tagline. */
const taglineSlot = (): HTMLElement => {
  const slot = document.querySelector('[data-hero-tagline-slot]');
  if (!(slot instanceof HTMLElement)) throw new Error('no tagline slot');
  return slot;
};

/** What a sighted reader sees of `node`, its runs of whitespace (no-break spaces too) made one. */
const seen = (node: Element | null | undefined): string =>
  (node?.textContent ?? '').replace(/\s+/gu, ' ').trim();

/**
 * A tagline about three times the built-in one (107 characters): three lines from a 24rem tile,
 * more on a phone.
 */
const LONG_TAGLINE =
  'Shipping fraud detection, payments infrastructure and the web around both, from first sketch to production.';

/** Where the role line says Mike is. */
const locationText = (): string =>
  seen(document.querySelector('[data-hero-location]')).replace(/^· /u, '');

/** The streamed role line, or null when the box is empty. */
const roleLine = (): HTMLParagraphElement | null => roleSlot().querySelector('p');

/** The role line without a location: the role alone, no separator left dangling. */
const expectRoleAlone = (role: string): void => {
  expect(seen(roleLine())).toBe(role);
  expect(roleLine()?.textContent).not.toContain('·');
  expect(document.querySelector('[data-hero-location]')).toBeNull();
};

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

/** The copy the first flush has: the tagline and the links (the role line streams). */
const expectFirstFlushCopy = (copy: HeroCopy): void => {
  expect(screen.getByText(copy.tagline).tagName).toBe('P');
  expect(contactHrefs()).toEqual(hrefsOf(copy));
};

/** The hero's copy, as the page shows it once streamed: the location too, or none. */
const expectCopy = (copy: HeroCopy): void => {
  if (copy.location === null) expect(document.querySelector('[data-hero-location]')).toBeNull();
  else expect(locationText()).toBe(copy.location);
  expectFirstFlushCopy(copy);
};

const ROLE = 'Founder & CEO, ResQ Systems';

const expectHeroReport = (level: 'error' | 'warning'): void => {
  expect(h.captureException).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ level, tags: { 'api.context': 'home hero tile' } }),
  );
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
});

describe('HeroTile', () => {
  it('has exactly one h1, named Mike Odnis, in the name style and the foreground colour', async () => {
    await renderHeroHtml();
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveAccessibleName('Mike Odnis');
    expect(headings[0]).toHaveAttribute('id', 'home-title');
    expect(headings[0]).toHaveClass('hero-name', 'text-foreground');
    expect(headings[0]?.className).not.toMatch(/text-brand|text-primary|font-extrabold/);
  });

  it('loads the avatar first, beside the name: eager, high fetch priority, drawn at 72 px', async () => {
    await renderHeroHtml();
    const avatar = screen.getByRole('img', {
      name: "Mike Odnis's avatar: a painting of a scholar writing at his desk",
    });
    expect(avatar).toHaveAttribute('loading', 'eager');
    expect(avatar).toHaveAttribute('fetchpriority', 'high');
    expect(avatar).toHaveAttribute('sizes', '72px');
    expect(avatar).toHaveAttribute('width', '72');
    expect(avatar).toHaveAttribute('height', '72');
    expect(avatar).toHaveClass('size-16', '@[30rem]:size-18');
    // One row: the name sits beside the avatar (and wraps under it when they do not fit).
    expect(avatar.parentElement).toBe(screen.getByRole('heading', { level: 1 }).parentElement);
    expect(avatar.parentElement).toHaveClass('flex', 'flex-wrap', 'items-center');
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

  // The refined type sets every button at 14/20 500; the filled one was 600.
  it('gives every link a 44 px tall target, in 14 px type at 500, the filled one too', async () => {
    await renderHeroHtml();
    for (const link of screen.getAllByRole('link')) {
      expect(link).toHaveClass('h-11', 'text-sm', 'font-medium');
      expect(link).not.toHaveClass('font-semibold');
    }
    expect(screen.getByRole('link', { name: 'Email me' })).toHaveClass('bg-brand', 'text-canvas');
  });

  // Owner: the 'Jump to… Ctrl K' button repeated the rail's and the phone bar's search.
  it('has no Jump to… button, no Now chip and no eyebrow', async () => {
    await renderHeroHtml();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(/jump to/i)).toBeNull();
    expect(screen.queryByText(/^now$/i)).toBeNull();
    expect(document.querySelector('[data-status-dot], kbd, .label-mono, .uppercase')).toBeNull();
  });

  // A tile hugs its content: the bento packs tiles by their own heights.
  it('hugs its content: nothing stretches it or pushes the links to its foot', async () => {
    await renderHeroHtml();
    const tile = screen.getByRole('heading', { level: 1 }).closest('.rounded-tile');
    expect(tile).not.toBeNull();
    expect(tile).not.toHaveClass('h-full');
    expect(tile?.querySelector('.h-full, .mt-auto, [class*="min-h-full"]')).toBeNull();
  });

  it('shows the positioning line in the tagline style, under the role line', async () => {
    await renderHeroHtml();
    expect(HERO_POSITIONING).toBe('Building web software end to end.');
    const tagline = screen.getByText(HERO_POSITIONING);
    expect(tagline.tagName).toBe('P');
    expect(tagline).toHaveClass('hero-tagline', 'text-muted-foreground');
    expect(roleSlot().querySelector('p')).toHaveClass('hero-role', 'text-foreground');
  });

  it('streams in the role line: position, company as people say it, then the location, muted', async () => {
    h.sanityFetchWithToken.mockResolvedValue(SETTINGS);
    await renderHeroHtml();
    const line = roleLine();
    expect(seen(line)).toBe('Founder & CEO, ResQ Systems · Brooklyn, NY');
    // The legal form is dropped, and 'at' became a comma.
    expect(line?.textContent).not.toMatch(/Inc\.| at /);
    const location = line?.querySelector('[data-hero-location]');
    expect(location).toHaveClass('text-muted-foreground');
    // A no-break space keeps the dot on the role's line when the line wraps.
    expect(location?.textContent).toBe(' · Brooklyn, NY');
  });

  // Studio allows a 40-character location and any position: unclamped, 'Founder & CEO, ResQ
  // Systems · Brooklyn, New York City, United States' took three lines on a 320 px phone, where
  // the box reserves two, and two in a 28 to 40rem hero, where it reserves one, so the hero grew
  // when the line streamed in. The location is the line's muted end, inside the clamp, so a long
  // one is cut first, with an ellipsis; the whole line stays in the DOM for screen readers.
  it('clamps the role line to the lines its box reserves, the location inside the clamp', async () => {
    const location = 'Brooklyn, New York City, United States';
    h.sanityFetchWithToken.mockResolvedValue({ ...SETTINGS, location });
    await renderHeroHtml();
    const line = roleLine();
    expect(line).toHaveClass('line-clamp-2', '@md:line-clamp-1', 'wrap-break-word', 'hero-role');
    expect(document.querySelector('[data-hero-location]')?.parentElement).toBe(line);
    expect(seen(line)).toBe(`${ROLE} · ${location}`);
    // The same steps as the box: N lines reserved at a width, N lines drawn there.
    const reserved = roleSlot()
      .className.split(' ')
      .filter((name) => name.includes('min-h-'))
      .map((name) => name.replace(/min-h-\[(\d)lh\]/u, 'line-clamp-$1'));
    const clamped = (line?.className ?? '').split(' ').filter((name) => name.includes('clamp'));
    expect(clamped.sort()).toEqual(reserved.sort());
  });

  it.each([
    ['empty', { status: 'empty' }],
    ['error', { status: 'error' }],
  ] as const)(
    'shows the location alone when roles are %s, in the reserved box',
    async (_, result) => {
      h.loadCurrentRoles.mockResolvedValue(result);
      h.sanityFetchWithToken.mockResolvedValue(SETTINGS);
      await renderHeroHtml();
      const slot = roleSlot();
      expect(slot).toHaveClass('hero-role', 'min-h-[2lh]', '@md:min-h-[1lh]');
      expect(seen(slot)).toBe(SETTINGS.location);
      expect(slot.querySelector('[aria-hidden]')).toBeNull();
    },
  );

  it('leaves the reserved box empty with neither a current role nor a location', async () => {
    h.loadCurrentRoles.mockResolvedValue({ status: 'empty' });
    await renderHeroHtml();
    const slot = roleSlot();
    expect(slot).toHaveClass('min-h-[2lh]', '@md:min-h-[1lh]');
    expect(slot.childElementCount).toBe(0);
    expect(seen(slot)).toBe('');
  });

  // The role line ('Founder & CEO, ResQ Systems · New York, NY') is about 390 px: a 32rem step
  // left an empty line under it in a hero whose content box is 28 to 32rem wide.
  it('reserves one line for the role from a 28rem hero content box, two below it', async () => {
    await renderHeroHtml();
    const slot = roleSlot();
    expect(slot).toHaveClass('min-h-[2lh]', '@md:min-h-[1lh]');
    expect(slot.className).not.toMatch(/@lg:min-h/);
  });

  it('puts the h1 in the first flush and a one-line placeholder bar in the role box', () => {
    h.loadCurrentRoles.mockReturnValue(pending());
    renderFirstFlush();
    expect(screen.getByRole('heading', { level: 1, name: 'Mike Odnis' })).toBeInTheDocument();
    const bar = roleSlot().querySelector('span[aria-hidden="true"]');
    expect(bar).toHaveClass('h-[1lh]', 'bg-surface-3');
    expect(roleSlot().querySelector('p')).toBeNull();
  });
});

describe('HeroTile with the site settings', () => {
  it('shows the location, the tagline and the contact links from the settings', async () => {
    h.sanityFetchWithToken.mockResolvedValue(SETTINGS);
    await renderHeroHtml();
    expectCopy(SETTINGS_COPY);
    expect(seen(roleSlot())).toBe('Founder & CEO, ResQ Systems · Brooklyn, NY');
    expect(screen.queryByText(HERO_POSITIONING)).toBeNull();
    expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName('Mike Odnis');
    expect(h.captureException).not.toHaveBeenCalled();
  });

  it("shows today's copy, and no location, when there is no settings document", async () => {
    await renderHeroHtml();
    expectCopy(HERO_FALLBACK_COPY);
    expectRoleAlone(ROLE);
    expect(h.captureException).not.toHaveBeenCalled();
  });

  // Owner decision: 'Clear the field in Studio to hide it.' The location has no built-in value.
  it('shows the role alone, the other settings kept, when the owner cleared the location', async () => {
    h.sanityFetchWithToken.mockResolvedValue({ ...SETTINGS, location: null });
    await renderHeroHtml();
    expectRoleAlone(ROLE);
    expectCopy({ ...SETTINGS_COPY, location: null });
    expect(h.captureException).not.toHaveBeenCalled();
  });

  // Studio refuses spaces only, but the API does not: such a location is taken as cleared, not as
  // a broken document, and the other fields still apply.
  it.each([
    ['spaces', '   '],
    ['an empty string', ''],
    ['a line break', ' \n\t '],
  ])(
    'takes a location of %s as cleared: the role alone, the other settings kept',
    async (_, location) => {
      h.sanityFetchWithToken.mockResolvedValue({ ...SETTINGS, location });
      await renderHeroHtml();
      expectRoleAlone(ROLE);
      expectCopy({ ...SETTINGS_COPY, location: null });
      expect(h.captureException).not.toHaveBeenCalled();
    },
  );

  it('drops an invalid location without bringing a built-in one back', async () => {
    h.sanityFetchWithToken.mockResolvedValue({
      ...SETTINGS,
      location: 'x'.repeat(SITE_LOCATION_MAX_LENGTH + 1),
    });
    await renderHeroHtml();
    expectRoleAlone(ROLE);
    expectCopy({ ...SETTINGS_COPY, location: null });
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
    // The location is the muted end of the role line, so the line is what has to wrap.
    expect(document.querySelector('[data-hero-location]')?.closest('p')).toHaveClass(
      'wrap-break-word',
    );
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

  it("renders today's copy, no location, and reports the hero tile when Sanity fails with nothing cached", async () => {
    h.sanityFetchWithToken.mockRejectedValue(new Error('Sanity answered 502 Bad Gateway'));
    await renderHeroHtml();
    expectCopy(HERO_FALLBACK_COPY);
    expectRoleAlone(ROLE);
    expectHeroReport('error');
  });

  it('shows the last good location when Sanity fails after a good load', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(T0);
    h.sanityFetchWithToken.mockResolvedValueOnce(SETTINGS);
    await loadHeroCopy();

    vi.setSystemTime(T0 + SANITY_CACHE_TTL_MS + 1);
    h.sanityFetchWithToken.mockRejectedValue(new Error('Sanity answered 502 Bad Gateway'));
    await renderHeroHtml();

    expect(seen(roleLine())).toBe(`${ROLE} · ${SETTINGS.location}`);
    expectCopy(SETTINGS_COPY);
    expect(h.captureException).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ level: 'warning' }),
    );
  });

  it('never brings back a location the owner cleared, when Sanity fails after that load', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(T0);
    h.sanityFetchWithToken.mockResolvedValueOnce(SETTINGS);
    await loadHeroCopy();
    vi.setSystemTime(T0 + SANITY_CACHE_TTL_MS + 1);
    h.sanityFetchWithToken.mockResolvedValueOnce({ ...SETTINGS, location: null });
    await loadHeroCopy();

    vi.setSystemTime(T0 + 2 * (SANITY_CACHE_TTL_MS + 1));
    h.sanityFetchWithToken.mockRejectedValue(new Error('Sanity answered 502 Bad Gateway'));
    await renderHeroHtml();

    expectRoleAlone(ROLE);
    expectCopy({ ...SETTINGS_COPY, location: null });
  });

  it('puts the h1, the tagline and all four links in the first flush while the settings load', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    h.sanityFetchWithToken.mockReturnValue(pending());
    renderFirstFlush();
    expect(screen.getByRole('heading', { level: 1, name: 'Mike Odnis' })).toBeInTheDocument();
    expect(within(screen.getByRole('list')).getAllByRole('link')).toHaveLength(4);
    expectFirstFlushCopy(HERO_FALLBACK_COPY);
  });

  it('fills the first flush from the settings last loaded, so a warm server swaps in no change', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(T0);
    h.sanityFetchWithToken.mockResolvedValueOnce(SETTINGS);
    await loadHeroCopy();

    vi.setSystemTime(T0 + SANITY_CACHE_TTL_MS + 1);
    h.sanityFetchWithToken.mockReturnValue(pending());
    renderFirstFlush();

    expectFirstFlushCopy(SETTINGS_COPY);
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
    expectFirstFlushCopy(HERO_FALLBACK_COPY);
    expectHeroReport('error');
    // Nothing known to match what streams in: the tagline's box is reserved.
    expect(taglineSlot().className).toBe(TAGLINE_SLOT_RESERVED_CLASS);
  });
});

describe('HeroTile on a server with nothing cached yet', () => {
  it('reserves tagline lines in the first flush, at the tagline’s own type', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    h.sanityFetchWithToken.mockReturnValue(pending());

    renderFirstFlush();

    expect(taglineSlot().className).toBe(TAGLINE_SLOT_RESERVED_CLASS);
    expect(taglineSlot()).toHaveClass('hero-tagline');
    expect(taglineSlot()).toHaveTextContent(HERO_POSITIONING);
    expect(screen.getByText(HERO_POSITIONING)).toHaveClass('hero-tagline');
  });

  // Measured in Chromium with Geist at 16 px: 120-character taglines took five lines at the
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
    expectFirstFlushCopy(HERO_FALLBACK_COPY);
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
    expectFirstFlushCopy(HERO_FALLBACK_COPY);
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

  it('answers the built-in copy, with no location, when the first load outlasts the deadline', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    h.sanityFetchWithToken.mockReturnValue(pending());
    const copy = loadHeroCopy();
    await vi.advanceTimersByTimeAsync(SERVER_TILE_DEADLINE_MS);

    expect(await copy).toEqual(HERO_FALLBACK_COPY);
    expect((await copy).location).toBeNull();
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

  it('has no built-in location: one the settings lack is none', () => {
    const settings = { _id: 'siteSettings', _type: 'siteSettings' } as const;
    expect(heroCopyOf({ ...settings, location: 'Brooklyn, NY' }).location).toBe('Brooklyn, NY');
    expect(heroCopyOf(settings).location).toBeNull();
    expect(heroCopyOf(null).location).toBeNull();
    expect(heroCopyOf(undefined).location).toBeNull();
  });

  it("is today's hero without settings, and says nothing about where Mike is", () => {
    expect(HERO_FALLBACK_COPY).toEqual({
      location: null,
      tagline: 'Building web software end to end.',
      email: app.email,
      githubUrl: 'https://github.com/WomB0ComB0',
      linkedinUrl: 'https://www.linkedin.com/in/mikeodnis/',
    });
  });
});

describe('HeroRoleLine', () => {
  it('reads "{position}, {company} · {location}" from the first role in Studio order', async () => {
    h.sanityFetchWithToken.mockResolvedValue(SETTINGS);
    const { container } = render((await HeroRoleLine()) as ReactElement);
    expect(seen(container)).toBe('Founder & CEO, ResQ Systems · Brooklyn, NY');
  });

  it('says only where Mike is without a current role', async () => {
    h.sanityFetchWithToken.mockResolvedValue(SETTINGS);
    h.loadCurrentRoles.mockResolvedValue({ status: 'empty' });
    const empty = render((await HeroRoleLine()) as ReactElement);
    expect(seen(empty.container)).toBe('Brooklyn, NY');
    cleanup();

    h.loadCurrentRoles.mockResolvedValue({ status: 'error' });
    const failed = render((await HeroRoleLine()) as ReactElement);
    expect(seen(failed.container)).toBe('Brooklyn, NY');
    expect(failed.container.querySelector('[data-hero-location]')?.textContent).toBe(
      'Brooklyn, NY',
    );
  });

  it('says only the role without a location, with no separator left over', async () => {
    const { container } = render((await HeroRoleLine()) as ReactElement);
    expect(seen(container)).toBe(ROLE);
    expect(container.textContent).not.toContain('·');
    expect(container.querySelector('[data-hero-location]')).toBeNull();
  });

  it('renders nothing with neither a current role nor a location', async () => {
    for (const status of ['empty', 'error'] as const) {
      h.loadCurrentRoles.mockResolvedValue({ status });
      expect(await HeroRoleLine()).toBeNull();
    }
  });

  it('gives a role whose company is blank its position alone', async () => {
    h.sanityFetchWithToken.mockResolvedValue(SETTINGS);
    h.loadCurrentRoles.mockResolvedValue({
      status: 'ok',
      data: { roles: [makeExperience({ position: 'Researcher', company: ' ' })], total: 1 },
      stale: false,
    });
    const { container } = render((await HeroRoleLine()) as ReactElement);
    expect(seen(container)).toBe('Researcher · Brooklyn, NY');
  });
});
