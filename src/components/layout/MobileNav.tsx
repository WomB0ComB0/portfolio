'use client';

import { NavbarItems } from '@/constants/index';
import { useKBar } from 'kbar';
import { useRouter } from 'next/navigation';
import { FiCommand } from 'react-icons/fi';

export default function MobileNavBar({ path }: { path: string }) {
  const { query } = useKBar();
  const router = useRouter();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#242424] border-t border-[#560BAD]/30 px-2 py-1 z-50">
      <div className="flex justify-between items-center max-w-screen-lg mx-auto">
        <div className="flex space-x-1 overflow-x-auto scrollbar-hide mx-auto ">
          {NavbarItems.map((item, index) => (
            <button
              key={index}
              className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all duration-300 ${
                path === item.slug
                  ? 'bg-[#560BAD] text-[#ba9bdd]'
                  : 'text-[#ba9bdd] hover:bg-[#560BAD]/20'
              }`}
              onClick={() => router.push(item.slug)}
            >
              <item.icon size="1.25rem" />
              <span className="text-[0.6rem] mt-1">{item.name}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center">
          <div className="w-px h-8 bg-[#560BAD]/30 mx-2"></div>
          <div className="flex space-x-1">
            <button
              className="p-2 rounded-lg bg-[#560BAD]/20 text-[#ba9bdd] hover:bg-[#560BAD]/30 transition-all duration-300"
              onClick={query.toggle}
              aria-label="Open command palette"
            >
              <FiCommand size="1.25rem" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
