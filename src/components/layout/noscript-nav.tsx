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
 * @file The navigation for a visitor without JavaScript. The rail's groups and the phone Menu are
 * buttons that open with JavaScript; without it their links are in the HTML but hidden and inert,
 * so no section page can be reached. This is the same list (Home and NAV_GROUPS, the config the
 * rail and the phone menu render from) as plain links, inside one `<noscript>`, in the shell's
 * footer zone: under the page, so it never pushes a page's h1 down the first screen.
 *
 * No directive, no hooks, no handlers. React renders a noscript's children on the server only: in
 * a browser that runs JavaScript the element is empty and not displayed, so the list moves
 * nothing. Plain `<a href>`: nothing could run a client navigation here.
 *
 * To remove it, delete its one line in layout.tsx (and this file with its test,
 * tests/unit/components/noscript-nav.test.tsx, and the "page list" checks in
 * e2e/seo/server-render.spec.ts).
 */

import type { ReactElement } from 'react';

import { HOME_NAV_ITEM, NAV_GROUPS, type NavItem, navLinkCurrent } from './nav';

/** The list's visible title and the landmark's name; no other nav of the shell uses it. */
export const NOSCRIPT_NAV_TITLE = 'All pages';

const TITLE_ID = 'noscript-nav-title';
const groupLabelId = (id: string): string => `noscript-nav-${id}`;

/**
 * The footer's own box (footer.tsx): as wide as the page column and centred under it, the page
 * gutter inside, a hairline above. With the footer below it the two read as one zone.
 */
const NAV_CLASS =
  '@container/pages mx-auto w-full max-w-shell border-t border-hairline px-(--page-gutter) py-6';

/**
 * One row per group, caption beside its links, until the list is 52rem wide (where the footer
 * itself goes to one line); from there the groups stand side by side as five columns.
 */
const GROUPS_CLASS =
  'm-0 grid list-none grid-cols-1 gap-y-1 p-0 @min-[52rem]/pages:grid-cols-5 @min-[52rem]/pages:gap-x-6';
const GROUP_CLASS =
  'grid grid-cols-[7.5rem_minmax(0,1fr)] items-baseline gap-x-4 @min-[52rem]/pages:block';

/** The rail flyouts' caption: the chrome's mono label. */
const CAPTION_CLASS = 'm-0 label-mono font-normal text-faint';

/**
 * Home's row has no caption (Home is in no group), only this empty box of a caption's height, so
 * its link lines up with every group's first link.
 */
const NO_CAPTION_CLASS = 'label-mono h-lh';

/**
 * The list's title, on a row of its own above the groups, a step brighter than their captions:
 * beside them, in the first column, it read as a sixth group holding only Home.
 */
const TITLE_CLASS = 'm-0 mb-3 label-mono font-normal text-muted-foreground';

const LINKS_CLASS =
  'm-0 flex list-none flex-wrap gap-x-5 p-0 @min-[52rem]/pages:mt-1 @min-[52rem]/pages:flex-col';

/**
 * A link in the flyouts' type. 32px tall for a mouse, 44px on a touch screen. Colour only on
 * hover (brand-ink and the footer's dotted underline); the current page is brand-ink throughout,
 * and so is the section of a detail page, without the weight. The colour fades on the base `a`
 * rule's transition (globals.css), so none is repeated here: the string is in every page's HTML
 * fourteen times.
 */
const LINK_CLASS =
  'inline-flex min-h-8 items-center text-body-sm text-foreground decoration-dotted underline-offset-4 hover:text-brand-ink hover:underline pointer-coarse:min-h-11 aria-[current=page]:font-medium aria-[current=page]:text-brand-ink aria-[current=true]:text-brand-ink';

interface PageLinksProps {
  readonly items: readonly NavItem[];
  readonly path: string;
  /** The id of the caption that names this group's links; the Home row has none. */
  readonly labelledBy?: string;
}

/**
 * A group's pages as plain links: the current page marked, or on a detail page its section, by
 * the rule the rail marks them with (navLinkCurrent).
 */
const PageLinks = ({ items, path, labelledBy }: PageLinksProps): ReactElement => (
  <ul aria-labelledby={labelledBy} className={LINKS_CLASS}>
    {items.map((item) => (
      <li key={item.slug}>
        <a href={item.slug} aria-current={navLinkCurrent(item.slug, path)} className={LINK_CLASS}>
          {item.name}
        </a>
      </li>
    ))}
  </ul>
);

export interface NoScriptNavProps {
  /** The current pathname, so the page the visitor is on is marked. */
  readonly path: string;
}

/**
 * Every page of the navigation as a visible link, for a visitor without JavaScript only.
 *
 * @example
 * <PageMain>{children}</PageMain>
 * <NoScriptNav path={pathname} />
 * <Footer />
 */
export function NoScriptNav({ path }: NoScriptNavProps): ReactElement {
  return (
    <noscript>
      <nav aria-labelledby={TITLE_ID} data-noscript-nav="" className={NAV_CLASS}>
        <h2 id={TITLE_ID} className={TITLE_CLASS}>
          {NOSCRIPT_NAV_TITLE}
        </h2>
        <ul className={GROUPS_CLASS}>
          {HOME_NAV_ITEM && (
            <li className={GROUP_CLASS}>
              <div aria-hidden="true" className={NO_CAPTION_CLASS} />
              <PageLinks items={[HOME_NAV_ITEM]} path={path} />
            </li>
          )}
          {NAV_GROUPS.map((group) => (
            <li key={group.id} className={GROUP_CLASS}>
              <div id={groupLabelId(group.id)} className={CAPTION_CLASS}>
                {group.label}
              </div>
              <PageLinks items={group.items} path={path} labelledBy={groupLabelId(group.id)} />
            </li>
          ))}
        </ul>
      </nav>
    </noscript>
  );
}
