'use client';

import { usePathname } from 'next/navigation';
// import BlurryBlob from '@/components/animations/background/blurry-blob';
import Palette from '@/components/cmd';
import { LightRays } from '@/components/ui/light-rays';
// import { DotPattern } from '@/components/magicui';
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
export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  return (
    <LiveBlocksProvider>
      <div className="relative min-h-screen bg-background font-clash">
        {/* <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />
          
          <DotPattern 
            className="absolute inset-0 text-foreground/[0.02]" 
            width={20} 
            height={20} 
            cr={0.6}
          />
          
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-3xl opacity-20" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent/10 rounded-full blur-3xl opacity-20" />
          
          <BlurryBlob
            firstBlobColor="bg-primary"
            secondBlobColor="bg-primary/50"
            className="ml-[70%] mr-[30%] opacity-10"
          />
        </div> */}

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
          <LightRays />
        </main>
        <div className="fixed bottom-0 left-0 right-0 z-50 block lg:hidden md:hidden">
          <MobileNavBar path={pathname ?? ''} />
        </div>
      </div>
    </LiveBlocksProvider>
  );
}
