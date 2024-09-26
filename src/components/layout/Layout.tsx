'use client';

import Palette from '@/components/CMD';
import BlurryBlob from '@/components/animation/background/blurry-blob';
import Footer from '@/components/layout/Footer';
import { DotPattern } from '@/components/magicui';
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
    <div className="relative min-h-screen bg-[#242424] font-clash">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
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
            <NavBar path={pathname} />
          </div>
          <div className="fixed top-0 w-full z-20 block lg:hidden md:hidden px-8 pt-4">
            <MobileNavBar path={pathname} />
          </div>
          <div className="w-full pt-16 lg:pt-0 lg:pl-[6%]">{children}</div>
        </div>
        <Footer />
      </main>
    </div>
  );
}
