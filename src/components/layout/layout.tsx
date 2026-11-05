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
import { LightRays } from '@/components/magicui/light-rays';
import { Footer, MobileNavBar, NavBar } from '.';

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
  <a
    href={`#${MAIN_CONTENT_ID}`}
    onClick={skipToMain}
    className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-100 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:font-semibold focus:text-primary-foreground focus:shadow-lg focus:outline-2 focus:outline-offset-2 focus:outline-ring"
  >
    Skip to content
  </a>
);

/**
 * @function Layout
 * @public
 * @description
 * Provides the core layout structure for all pages within the application. It establishes
 * the visual foundation, global styling, core navigation (side and mobile bars), animated
 * backgrounds/effects, and children content. The component ensures a responsive, visually-rich
 * shell using overlayed SVG/canvas backgrounds, contextual navigation bars, and a global command palette.
 *
 * @param {Readonly<{children: React.ReactNode}>} props - Props object containing the children React nodes to render within the layout.
 *   @param {React.ReactNode} props.children - The main child content for the layout (routed page content).
 * @returns {JSX.Element} A React JSX element composing the full application layout, including navigation, backgrounds, and children.
 * @throws {Error} If required child components fail to render, or if any sub-provider encounters an initialization error.
 * @example
 * // Usage wrapping a page route:
 * <Layout>
 *   <YourPageContent />
 * </Layout>
 * @author Mike Odnis
 * @see https://github.com/WomB0ComB0/portfolio
 * @web
 * @version 2.0.0
 */
export const Layout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => {
  const pathname = usePathname();
  return (
    <div className="relative min-h-screen bg-background font-clash">
      <SkipToContent />
      {/* <ShaderBackground> */}
      {/* Exactly one nav is shown at every width: the sidebar from lg up, the bottom bar below it.
          The hidden one uses display:none so it leaves the tab order. The pb-16 pairs here and on
          the <main> keep the content and the footer clear of the fixed bottom bar. */}
      <div className="relative z-10 flex flex-col items-center min-h-screen overflow-x-hidden overflow-y-hidden pb-16 lg:pb-0 selection:bg-primary/30">
        <Palette />
        <div className="flex w-full h-full lg:w-[60%] md:w-2/3">
          <header className="w-[6%] fixed left-0 h-full z-20 hidden lg:block">
            <NavBar path={pathname ?? ''} />
          </header>
          {/* The one <main>: page content only, with the navs and the footer outside it. */}
          <PageMain className="w-full pt-16 lg:pt-0 lg:pl-[6%] relative z-20 pb-16 lg:pb-0">
            {children}
          </PageMain>
        </div>
        <Footer />
        <LightRays count={5} blur={20} />
      </div>
      <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
        <MobileNavBar path={pathname ?? ''} />
      </div>
    </div>
  );
};
Layout.displayName = 'Layout';
export default Layout;
