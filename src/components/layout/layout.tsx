'use client';

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

import { usePathname } from 'next/navigation';
import { MAIN_CONTENT_ID, PageMain } from '@/components/animations/pages/page-transition';
import Palette from '@/components/cmd';
import { SpotlightRoot } from '@/components/console/spotlight-root';
import { Footer, MobileNavBar, NavBar } from '.';
// Not through the barrel: tests stand in for the barrel's navs and footer only.
import { EdgeHaze } from './edge-haze';
import { LightRays } from './light-rays';

/**
 * The page canvas, lit as it was before #603. `light-glows` (light-rays.css) paints LightRays'
 * two faint glows, sized to the whole page as they were; `relative isolate` makes the root the box
 * and the stacking context the rays sit in at z-index -1, over the canvas and under everything
 * else (every portal is z-50 or above, after the root, so still above it). overflow-x-clip,
 * unlike hidden, keeps position: sticky working.
 */
const ROOT_CLASS = 'light-glows relative isolate min-h-dvh overflow-x-clip bg-canvas';

/**
 * The 64 px rail, from lg up. display:none below lg takes it out of the tab order. z-40 keeps its
 * flyouts above in-page sticky bars (FilterBar is sticky z-30 from lg; main is no stacking context)
 * and below every z-50 overlay: the palette, dialogs, sheets and the bottom bar.
 */
const RAIL_CLASS = 'fixed inset-y-0 left-0 z-40 hidden w-16 lg:block';

/**
 * The column beside the rail: main, then the footer. Below lg its bottom padding is the fixed
 * bottom bar's full height, --mobile-bar-total (globals.css), the one value the bar's own height
 * reads too, so the end of the footer scrolls clear of the bar.
 */
const COLUMN_CLASS = 'flex min-h-dvh flex-col pb-(--mobile-bar-total) lg:pb-0 lg:pl-16';

/**
 * The page column: at most max-w-shell (75rem), centred in the space beside the rail, and the
 * `page` container for container queries. No horizontal padding: PageShell and TileGrid apply
 * --page-gutter themselves, and legacy pages keep their own padding.
 */
const MAIN_CLASS = 'relative mx-auto w-full max-w-shell flex-1 @container/page py-6 md:py-10';

/** The bottom bar, below lg only. */
const BOTTOM_BAR_CLASS = 'fixed inset-x-0 bottom-0 z-50 lg:hidden';

const SKIP_LINK_CLASS =
  'sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-100 focus:rounded-md focus:border focus:border-hairline-strong focus:bg-surface-2 focus:px-4 focus:py-2 focus:font-medium focus:text-foreground focus:shadow-raised focus:outline-2 focus:outline-offset-2 focus:outline-focus';

/**
 * Moves focus and the viewport to the page's `<main>` without a fragment navigation. A native
 * jump to #main-content adds a history entry with null state, which the app router ignores on
 * popstate, so Back after a later client navigation would change the URL but keep the newer page.
 */
const skipToMain = (event: React.MouseEvent<HTMLAnchorElement>): void => {
  event.preventDefault();
  const main = document.getElementById(MAIN_CONTENT_ID);
  main?.focus({ preventScroll: false });
  main?.scrollIntoView();
};

/**
 * The first focusable element on every page: hidden until focused, then shown over the top-left
 * corner. It moves focus past the navs to the page's `<main>`; the href is the fallback before
 * hydration and without JavaScript.
 */
const SkipToContent = () => (
  <a href={`#${MAIN_CONTENT_ID}`} onClick={skipToMain} className={SKIP_LINK_CLASS}>
    Skip to content
  </a>
);

/**
 * The site shell around every page: the light rays under it all, skip link, command palette, the
 * tile spotlight's pointer listener, the navs, the one `<main>`, the footer and the scroll edge
 * haze over them.
 *
 * Exactly one nav shows at every width: the 64 px rail from lg up, the bottom bar below it. Main
 * and the footer share one column offset by the rail, each at most max-w-shell wide and centred
 * in it, so the footer sits under the content at every width.
 *
 * @example
 * <Layout>
 *   <YourPageContent />
 * </Layout>
 */
export const Layout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => {
  const pathname = usePathname();
  return (
    <div className={ROOT_CLASS}>
      {/* First, under everything (z-index -1 in the root); nothing in it takes focus or input. */}
      <LightRays />
      <SkipToContent />
      <Palette />
      <SpotlightRoot />
      <header className={RAIL_CLASS}>
        <NavBar path={pathname ?? ''} />
      </header>
      <div className={COLUMN_CLASS}>
        {/* The one <main>: page content only, with the navs and the footer outside it. */}
        <PageMain className={MAIN_CLASS}>{children}</PageMain>
        <Footer />
      </div>
      {/* Fixed over the column at z-20, under the FilterBar, the rail, the bar and overlays. */}
      <EdgeHaze path={pathname ?? ''} />
      <div className={BOTTOM_BAR_CLASS}>
        <MobileNavBar path={pathname ?? ''} />
      </div>
    </div>
  );
};
Layout.displayName = 'Layout';
export default Layout;
