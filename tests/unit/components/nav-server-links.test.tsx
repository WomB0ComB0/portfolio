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
 * @file Every destination the navigation offers is a plain `<a href>` in the rail's server HTML.
 *
 * A crawler reads the HTML and presses no button, so a page that is linked only from a flyout
 * that renders when opened has no crawlable link at all. The rail is in every page's HTML at
 * every width (below lg it is display:none, layout.tsx), so its flyouts carry the links: each one
 * is rendered closed, hidden and inert, never left out.
 */

import { KBarProvider } from 'kbar';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { NAV_GROUPS, NavBar } from '@/components/layout/nav';
import { NavbarItems } from '@/constants/index';

// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});

/** The rail's server HTML for a page, parsed into a detached container. */
const serverRail = (path: string): HTMLElement => {
  const container = document.createElement('div');
  container.innerHTML = renderToString(
    <KBarProvider>
      <NavBar path={path} />
    </KBarProvider>,
  );
  return container;
};

const hrefsIn = (root: Element): string[] =>
  [...root.querySelectorAll('a[href]')].map((anchor) => anchor.getAttribute('href') ?? '');

const classesOf = (element: Element): string[] =>
  (element.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);

/** The flyout panels only: a flyout's label shares the id prefix. */
const panelsIn = (root: Element): Element[] =>
  [...root.querySelectorAll('[id^="nav-flyout-"]')].filter(
    (element) => !element.id.endsWith('-label'),
  );

describe('the rail in server HTML', () => {
  it('puts every page of the nav in a group, so none is left without a link', () => {
    const grouped = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.slug));

    expect([...grouped, '/'].sort()).toEqual(NavbarItems.map((item) => item.slug).sort());
  });

  it.each(['/', '/projects', '/media', '/stats/anything', '/no-such-page'])(
    'links every destination once with a plain <a href> on %s',
    (path) => {
      const hrefs = hrefsIn(serverRail(path));

      expect([...hrefs].sort()).toEqual(NavbarItems.map((item) => item.slug).sort());
    },
  );

  it('names each link by its page, so the anchor text says where it goes', () => {
    const rail = serverRail('/');

    for (const item of NavbarItems.filter((entry) => entry.slug !== '/')) {
      const anchor = rail.querySelector(`a[href="${item.slug}"]`);
      expect(anchor?.textContent).toBe(item.name);
    }
    expect(rail.querySelector('a[href="/"]')).toHaveAttribute('aria-label', 'Home');
  });

  it('renders every flyout closed: hidden, inert, and still controlled by its trigger', () => {
    const rail = serverRail('/projects');
    const panels = panelsIn(rail);

    expect(panels.map((panel) => panel.id)).toEqual(
      NAV_GROUPS.map((group) => `nav-flyout-${group.id}`),
    );
    for (const panel of panels) {
      expect(panel).toHaveAttribute('inert');
      // visibility: hidden, never display: none or sr-only: no tab stop, no accessible name.
      expect(classesOf(panel)).toEqual(expect.arrayContaining(['invisible', 'opacity-0']));
      expect(classesOf(panel).filter((name) => /^(?:hidden|sr-only|visible)$/.test(name))).toEqual(
        [],
      );
      const trigger = rail.querySelector(`button[aria-controls="${panel.id}"]`);
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    }
  });

  it('gives no flyout link a tabindex or an aria-hidden of its own', () => {
    const anchors = panelsIn(serverRail('/')).flatMap((panel) => [...panel.querySelectorAll('a')]);

    expect(anchors).toHaveLength(NavbarItems.length - 1);
    for (const anchor of anchors) {
      expect(anchor).not.toHaveAttribute('tabindex');
      expect(anchor).not.toHaveAttribute('aria-hidden');
    }
  });

  it('marks the current page on its link in the server HTML', () => {
    const rail = serverRail('/media');

    const current = [...rail.querySelectorAll('a[aria-current="page"]')].map((anchor) =>
      anchor.getAttribute('href'),
    );
    expect(current).toEqual(['/media']);
  });
});
