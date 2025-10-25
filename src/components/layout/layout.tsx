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

'use client';

import { usePathname } from 'next/navigation';
import Palette from '@/components/cmd';
import { LightRays } from '@/components/magicui/light-rays';
import { LiveBlocksProvider } from '@/providers/core';
import { Footer, MobileNavBar, NavBar } from '.';

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
    <LiveBlocksProvider>
      <div className="relative min-h-screen bg-background font-clash">
        <main className="relative z-10 flex flex-col items-center min-h-screen overflow-x-hidden selection:bg-primary/30">
          <Palette />
          <div className="flex w-full h-full lg:w-[60%] md:w-2/3">
            <div className="w-[6%] fixed left-0 h-full z-20 hidden lg:block md:block">
              <NavBar path={pathname ?? ''} />
            </div>
            <div className="w-full pt-16 lg:pt-0 lg:pl-[6%] relative z-20 pb-16 md:pb-0">
              {children}
            </div>
          </div>
          <Footer />
          <LightRays count={3} blur={10} />
        </main>
        <div className="fixed bottom-0 left-0 right-0 z-50 block lg:hidden md:hidden">
          <MobileNavBar path={pathname ?? ''} />
        </div>
      </div>
    </LiveBlocksProvider>
  );
};
Layout.displayName = 'Layout';
export default Layout;
