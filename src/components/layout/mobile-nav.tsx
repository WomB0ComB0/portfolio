'use client';

import { useKBar } from 'kbar';
import Link from 'next/link';
import { FiCommand } from 'react-icons/fi';
import { Button } from '@/components/ui/button';
import { NavbarItems } from '@/constants/index';

export const MobileNavBar = ({ path }: { path: string }) => {
  const { query } = useKBar();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#242424] border-t border-[#560BAD]/30 px-2 py-2 z-40 safe-area-inset-bottom">
      <div className="flex justify-between items-center max-w-screen-xl mx-auto gap-2">
        <div className="flex space-x-1 overflow-x-auto scrollbar-hide flex-1">
          {NavbarItems.map((item, index) => (
            <Button
              key={index}
              asChild
              variant="ghost"
              size="sm"
              className={`flex flex-col items-center justify-center min-w-[60px] h-auto py-1.5 px-2 rounded-lg transition-all duration-300 ${path === item.slug
                  ? 'bg-[#560BAD] text-[#ba9bdd] hover:bg-[#560BAD]/90'
                  : 'text-[#ba9bdd]/70 hover:bg-[#560BAD]/20 hover:text-[#ba9bdd]'
                }`}
              suppressHydrationWarning
            >
              <Link href={item.slug} className="flex flex-col items-center justify-center gap-0.5">
                <item.icon size="1.1rem" />
                <span className="text-[0.6rem] leading-tight whitespace-nowrap">{item.name}</span>
              </Link>
            </Button>
          ))}
        </div>
        <div className="flex items-center">
          <div className="w-px h-10 bg-[#560BAD]/30 mx-1"></div>
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col items-center justify-center min-w-[50px] h-auto py-1.5 px-2 rounded-lg bg-[#560BAD]/20 text-[#ba9bdd] hover:bg-[#560BAD]/30 transition-all duration-300"
            onClick={query.toggle}
            aria-label="Open command palette"
            suppressHydrationWarning
          >
            <FiCommand size="1.1rem" />
            <span className="text-[0.6rem] leading-tight mt-0.5">Cmd</span>
          </Button>
        </div>
      </div>
    </nav>
  );
};
MobileNavBar.displayName = 'MobileNavBar';
export default MobileNavBar;
