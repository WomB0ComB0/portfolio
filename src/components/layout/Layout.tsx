'use client';

import Palette from '@/components/CMD';
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
    <div>
      <main className="flex selection:bg-purple-200/30 flex-col overflow-x-hidden min-h-screen items-center bg-[#242424] font-clash max-h-auto relative">
        <Palette />
        <div className="flex w-full h-full lg:w-[60%] md:w-2/3">
          <div className="w-[6%] fixed left-0 h-full z-50 hidden lg:block md:block">
            <NavBar path={pathname} />
          </div>
          <div className="fixed top-0 w-full z-50 block lg:hidden md:hidden px-8 pt-4">
            <MobileNavBar path={pathname} />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
