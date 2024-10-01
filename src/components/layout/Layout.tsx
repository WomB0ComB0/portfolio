'use client';

import Palette from '@/components/CMD';
import BlurryBlob from '@/components/animation/background/blurry-blob';
import Footer from '@/components/layout/Footer';
import { DotPattern } from '@/components/magicui';
// import { LiveBlocksProvider } from '@/providers/core/LiveRoom';
import { usePathname } from 'next/navigation';
import MobileNavBar from './MobileNav';
import NavBar from './Nav';

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  return (
    <>
      <div className="relative min-h-screen bg-[#242424] font-clash">
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <DotPattern className="absolute inset-0" />
          <BlurryBlob
            firstBlobColor="bg-purple-700"
            secondBlobColor="bg-purple-400"
            className="ml-[70%] mr-[30%] absolute inset-0 opacity-20"
          />
        </div>
        <main className="relative z-10 flex flex-col items-center min-h-screen overflow-x-hidden selection:bg-purple-200/30">
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
        </main>
        <div className="fixed bottom-0 left-0 right-0 z-50 block lg:hidden md:hidden">
          <MobileNavBar path={pathname ?? ''} />
        </div>
      </div>
    </>
  );
}
