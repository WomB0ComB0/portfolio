'use client';

import { useKBar } from 'kbar';
import Link from 'next/link';
import { FiCommand } from 'react-icons/fi';
import { Button } from '@/components/ui/button';
import { NavbarItems } from '@/constants/index';

export const MobileNavBar = ({ path }: { path: string }) => {
  const { query } = useKBar();

  return (
    <nav className="bg-[#242424] border-t border-[#560BAD]/30 px-2 py-1">
      <div className="flex justify-between items-center max-w-screen-lg mx-auto">
        <div className="flex space-x-1 overflow-x-auto scrollbar-hide mx-auto">
          {NavbarItems.map((item, index) => (
            <Button
              key={index}
              asChild
              className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all duration-300 ${
                path === item.slug
                  ? 'bg-[#560BAD] text-[#ba9bdd]'
                  : 'text-[#ba9bdd] hover:bg-[#560BAD]/20'
              }`}
              suppressHydrationWarning
            >
              <Link href={item.slug}>
                <item.icon size="1.25rem" />
                <span className="text-[0.6rem] mt-1">{item.name}</span>
              </Link>
            </Button>
          ))}
        </div>
        <div className="flex items-center">
          <div className="w-px h-8 bg-[#560BAD]/30 mx-2"></div>
          <div className="flex space-x-1">
            <Button
              className="p-2 rounded-lg bg-[#560BAD]/20 text-[#ba9bdd] hover:bg-[#560BAD]/30 transition-all duration-300"
              onClick={query.toggle}
              aria-label="Open command palette"
              suppressHydrationWarning
            >
              <FiCommand size="1.25rem" />
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};
MobileNavBar.displayName = 'MobileNavBar';
export default MobileNavBar;
