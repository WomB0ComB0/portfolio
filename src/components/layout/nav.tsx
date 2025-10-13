'use client';

import { useKBar } from 'kbar';
import React, { useState } from 'react';
import { FiCommand } from 'react-icons/fi';
import { NavbarItems } from '@/constants/index';

export const NavBar = ({ path }: { path: string }) => {
  const { query } = useKBar();
  const [tooltipVisibility, setTooltipVisibility] = useState(Array(7).fill(false));

  return (
    <div className="w-full min-h-full h-full flex flex-col justify-start items-center pt-6">
      <div className="flex flex-col gap-4">
        {NavbarItems.map((item, index) => {
          const isActive = path === item.slug;
          return (
            <div key={item.slug}>
              <button
                className={`w-full flex justify-center items-center ${
                  isActive
                    ? 'bg-[#560BAD] hover:bg-[#560BAD]/80'
                    : 'bg-[#242424] hover:bg-[#560BAD]/50'
                } shadow hover:shadow-xl rounded hover:scale-110 duration-300 ease-in-out relative`}
                onMouseLeave={() => {
                  const temp = [...tooltipVisibility];
                  temp[index] = false;
                  setTooltipVisibility(temp);
                }}
                onMouseEnter={() => {
                  const temp = [...tooltipVisibility];
                  temp[index] = true;
                  setTooltipVisibility(temp);
                }}
                onClick={() => window.open(item.slug, '_self')}
                aria-label={`${item.name} link`}
              >
                <div className="p-2">
                  <item.icon size="1rem" className="text-[#ba9bdd]" />
                </div>
                {tooltipVisibility[index] && (
                  <span className="absolute min-w-max text-[0.75rem] leading-none left-10 p-[0.62rem] rounded shadow-xl text-[#ba9bdd] bg-[#242424] border border-[#560BAD]">
                    {item.name}
                  </span>
                )}
              </button>
            </div>
          );
        })}
        <div className="flex flex-col gap-4">
          <button
            className="w-full flex justify-center items-center bg-[#242424] hover:bg-[#560BAD]/50 shadow hover:shadow-xl rounded hover:scale-110 duration-300 ease-in-out"
            onClick={query.toggle}
            aria-label="Open command menu"
          >
            <div className="p-2">
              <FiCommand size="1rem" className="text-[#ba9bdd]" />
            </div>
          </button>
        </div>
      </div>
      <div className="border-r-2 border-[#ba9bdd] h-full mt-4"></div>
    </div>
  );
};
NavBar.displayName = 'NavBar';
export default NavBar;
