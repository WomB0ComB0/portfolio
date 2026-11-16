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
 * @file The navigation for a visitor without JavaScript: every destination of the rail's own
 * config as a plain link, inside one `<noscript>` in the shell's footer zone.
 *
 * The rail's groups and the phone Menu are buttons that need JavaScript; without it their links
 * are in the HTML but hidden and inert, so no section page could be reached. With JavaScript the
 * list must cost nothing: React renders a noscript's children on the server only, so in the
 * browser the element is empty and moves nothing.
 */

import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import Layout from '@/components/layout/layout';
import { HOME_NAV_ITEM, NAV_GROUPS } from '@/components/layout/nav';
import { NOSCRIPT_NAV_TITLE, NoScriptNav } from '@/components/layout/noscript-nav';
import { NavbarItems } from '@/constants/index';

vi.mock('next/navigation', () => ({ usePathname: () => '/media' }));
// The command palette and the tile spotlight's pointer listener are not under test.
vi.mock('@/components/cmd', () => ({ default: () => null }));
vi.mock('@/components/console/spotlight-root', () => ({ SpotlightRoot: () => null }));
// layout.tsx imports the navs and footer from its own barrel; the list is not in the barrel.
vi.mock('@/components/layout', () => ({
  NavBar: () => <nav aria-label="Main navigation" />,
  MobileNavBar: () => <nav aria-label="Mobile navigation" />,
  Footer: () => <footer />,
}));
// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});

/** Home, then each group's pages: the order the rail and the phone menu show them in. */
const DESTINATIONS = [
  ...(HOME_NAV_ITEM ? [HOME_NAV_ITEM] : []),
  ...NAV_GROUPS.flatMap((group) => group.items),
];

/** Every name another navigation landmark of the shell already uses. */
const TAKEN_NAV_NAMES = ['Main navigation', 'Mobile navigation', 'Site pages'];

/** Utilities that can set a colour, by prefix. */
const COLOUR_PREFIX = /^(?:text|bg|border|decoration|ring|outline|fill|stroke|shadow|from|to)-/;

/**
 * Every such utility the list may use: the three text tiers, brand-ink and the hairline, plus
 * the ones that share a prefix and set no colour (a type size, a border side, a line style).
 */
const ALLOWED_UTILITIES = new Set([
  'text-foreground',
  'text-muted-foreground',
  'text-faint',
  'text-brand-ink',
  'border-hairline',
  'text-body-sm',
  'border-t',
  'decoration-dotted',
]);

const serverHtml = (path: string): string => renderToStaticMarkup(<NoScriptNav path={path} />);

/**
 * The list as a visitor without JavaScript gets it: what the one `<noscript>` holds, parsed.
 * (jsdom runs scripts, so it would keep a noscript's own children as text.)
 */
function listFor(path: string): HTMLElement {
  const inner = /^<noscript>([\s\S]*)<\/noscript>$/.exec(serverHtml(path))?.[1];
  if (inner === undefined) throw new Error('the list is not inside one <noscript>');
  const container = document.createElement('div');
  container.innerHTML = inner;
  return container;
}

const anchorsIn = (root: Element): HTMLAnchorElement[] => [...root.querySelectorAll('a')];

const classesIn = (root: Element): string[] =>
  [...root.querySelectorAll('[class]')].flatMap((element) =>
    (element.getAttribute('class') ?? '').split(/\s+/).filter(Boolean),
  );

/** A class without its variants: `hover:text-brand-ink` is `text-brand-ink`. */
const utilityOf = (name: string): string => name.split(':').at(-1) ?? name;

describe('the page list for a visitor without JavaScript', () => {
  it('is one <noscript> and nothing outside it', () => {
    const html = serverHtml('/');

    expect(html.startsWith('<noscript>')).toBe(true);
    expect(html.endsWith('</noscript>')).toBe(true);
    expect(html.match(/<noscript>/g)).toHaveLength(1);
  });

  it('is a navigation landmark with a visible name no other nav of the shell uses', () => {
    const list = listFor('/');
    const navs = list.querySelectorAll('nav');
    const title = list.querySelector(`#${navs[0]?.getAttribute('aria-labelledby')}`);

    expect(navs).toHaveLength(1);
    expect(title?.tagName).toBe('H2');
    expect(title?.textContent).toBe(NOSCRIPT_NAV_TITLE);
    expect(TAKEN_NAV_NAMES).not.toContain(NOSCRIPT_NAV_TITLE);
    expect(classesIn(list)).not.toContain('sr-only');
  });

  it.each(['/', '/projects', '/media', '/stats/anything', '/no-such-page'])(
    "links every destination of the rail's own config once, in its order, on %s",
    (path) => {
      const hrefs = anchorsIn(listFor(path)).map((anchor) => anchor.getAttribute('href'));

      expect(hrefs).toEqual(DESTINATIONS.map((item) => item.slug));
      // The config holds every page of the nav (Home and the four groups), so none is left out.
      expect([...hrefs].sort()).toEqual(NavbarItems.map((item) => item.slug).sort());
    },
  );

  it('names each link by its page and each group by its label', () => {
    const list = listFor('/');

    for (const item of DESTINATIONS) {
      expect(list.querySelector(`a[href="${item.slug}"]`)?.textContent).toBe(item.name);
    }
    for (const group of NAV_GROUPS) {
      const links = list.querySelector(`a[href="${group.items[0]?.slug}"]`)?.closest('ul');
      const label = list.querySelector(`#${links?.getAttribute('aria-labelledby')}`);
      expect(label?.textContent).toBe(group.label);
      expect(links?.querySelectorAll('a')).toHaveLength(group.items.length);
    }
  });

  it('uses plain links: an href, and nothing that needs a script or leaves the tab', () => {
    for (const anchor of anchorsIn(listFor('/licenses'))) {
      const extra = anchor
        .getAttributeNames()
        .filter((name) => !['aria-current', 'class', 'href'].includes(name));
      expect(extra).toEqual([]);
      expect(anchor.getAttribute('href')).toMatch(/^\/[a-z]*$/);
    }
  });

  // On a detail page the section is marked as the rail marks it (isGroupActive's rule), but as
  // the section (aria-current="true"), not as the page itself.
  it('marks the current page, its section on a detail page, and nothing on an unknown URL', () => {
    const markedOn = (path: string) =>
      anchorsIn(listFor(path))
        .filter((anchor) => anchor.hasAttribute('aria-current'))
        .map((anchor) => `${anchor.getAttribute('href')}=${anchor.getAttribute('aria-current')}`);

    expect(markedOn('/')).toEqual(['/=page']);
    expect(markedOn('/media')).toEqual(['/media=page']);
    expect(markedOn('/projects/some-id')).toEqual(['/projects=true']);
    expect(markedOn('/experience/a/b')).toEqual(['/experience=true']);
    expect(markedOn('/projectsx')).toEqual([]);
    expect(markedOn('/no-such-page')).toEqual([]);
  });

  it('paints the section link in brand-ink, as the current page is', () => {
    const section = listFor('/projects/some-id').querySelector('a[aria-current="true"]');

    expect(section?.getAttribute('class')).toContain('aria-[current=true]:text-brand-ink');
  });

  // "ALL PAGES" over a lone Home read as a sixth group holding only Home.
  it('titles the whole list above its groups, and gives Home no group caption', () => {
    const nav = listFor('/').querySelector('nav');
    const title = nav?.querySelector('h2');
    const homeLinks = nav?.querySelector('a[href="/"]')?.closest('ul');

    expect(nav?.firstElementChild).toBe(title);
    expect(title?.closest('ul')).toBeNull();
    expect(homeLinks?.hasAttribute('aria-labelledby')).toBe(false);
    expect(homeLinks?.closest('li')?.textContent).toBe(HOME_NAV_ITEM?.name);
  });

  it('colours with palette tokens only, never scales, and sets no inline style', () => {
    const list = listFor('/');
    const utilities = classesIn(list).map(utilityOf);
    const colourLike = utilities.filter((name) => COLOUR_PREFIX.test(name));

    expect(colourLike).toEqual(expect.arrayContaining(['text-foreground', 'border-hairline']));
    expect([...new Set(colourLike)].filter((name) => !ALLOWED_UTILITIES.has(name))).toEqual([]);
    expect(utilities.filter((name) => /^-?scale-/.test(name))).toEqual([]);
    expect(list.querySelectorAll('[style]')).toHaveLength(0);
  });

  it('sets its captions and links in the chrome type classes the rail flyouts use', () => {
    const list = listFor('/');

    expect(list.querySelector('h2')?.classList.contains('label-mono')).toBe(true);
    for (const group of NAV_GROUPS) {
      const links = list.querySelector(`a[href="${group.items[0]?.slug}"]`)?.closest('ul');
      const label = list.querySelector(`#${links?.getAttribute('aria-labelledby')}`);
      expect(label?.classList.contains('label-mono')).toBe(true);
    }
    for (const anchor of anchorsIn(list)) {
      expect(anchor.classList.contains('text-body-sm')).toBe(true);
    }
  });
});

describe('the shell and the page list', () => {
  it('puts the list in the footer zone of the server HTML: after main, before the footer', () => {
    const html = renderToString(
      <Layout>
        <h1>Media</h1>
      </Layout>,
    );
    const mainEnd = html.indexOf('</main>');
    const list = html.indexOf('<noscript>');
    const footer = html.indexOf('<footer');

    expect(mainEnd).toBeGreaterThan(-1);
    expect(list).toBeGreaterThan(mainEnd);
    expect(footer).toBeGreaterThan(list);
    expect(html.match(/<noscript>/g)).toHaveLength(1);
    // The page the shell is on (usePathname) is the one marked.
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toMatch(/<a href="\/media"[^>]*aria-current="page"/);
  });

  it('renders nothing of it in the browser: an empty noscript, no third nav landmark', () => {
    const { container } = render(
      <Layout>
        <h1>Media</h1>
      </Layout>,
    );
    const main = screen.getByRole('main');
    const noscript = container.querySelector('noscript');

    expect(noscript).not.toBeNull();
    expect(main.nextElementSibling).toBe(noscript);
    expect(noscript?.nextElementSibling).toBe(screen.getByRole('contentinfo'));
    expect(noscript?.childNodes).toHaveLength(0);
    expect(screen.getAllByRole('navigation')).toHaveLength(2);
    expect(screen.queryByRole('navigation', { name: NOSCRIPT_NAV_TITLE })).toBeNull();
  });
});
