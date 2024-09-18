'use client';
import { NavbarItems } from '@/constants/index';
import { useKBar } from 'kbar';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/router';
import React from 'react';
import { useEffect, useState } from 'react';
import { FiCommand, FiMoon, FiSun } from 'react-icons/fi';

export default function NavBar({ path }: { path: string }) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { query } = useKBar();
  const [mounted, _setMounted] = useState(false);
  const [tooltipVisibility, setTooltipVisibility] = useState(Array(7).fill(false));
  return (
    <div className="w-full min-h-full h-full flex flex-col justify-start items-center pt-6">
      <div className="flex flex-col gap-4">
        {NavbarItems.map((item, index) => {
          return (
            <div key={item.slug}>
              {path === item.slug ? (
                <button
                  key={index}
                  className="w-full flex justify-center items-center dark:bg-zinc-700 bg-zinc-800 dark:hover:bg-zinc-700 hover:bg-zinc-800 focus:bg-zinc-800 shadow hover:shadow-xl rounded hover:scale-110 duration-300 ease-in-out dark:focus:bg-zinc-700 relative"
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
                  onClick={() => router.push(item.slug)}
                >
                  <div className="p-2">
                    <item.icon size="1rem" className="text-zinc-100" />
                  </div>
                  {tooltipVisibility[index] && (
                    <span className="absolute min-w-full text-[0.75rem] leading-none left-10 p-[0.62rem] rounded shadow-xl text-zinc-200 dark:bg-zinc-700 bg-zinc-800">
                      {item.name}
                    </span>
                  )}
                </button>
              ) : (
                <button
                  key={index}
                  className="w-full flex justify-center items-center dark:bg-zinc-800 dark:hover:bg-zinc-700 shadow hover:shadow-xl rounded hover:scale-110 duration-300 ease-in-out dark:focus:bg-zinc-700 bg-zinc-700 hover:bg-zinc-800 focus:bg-zinc-800 relative"
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
                  onClick={() => router.push(item.slug)}
                >
                  <div className="p-2">
                    <item.icon size="1rem" className="text-zinc-100" />
                  </div>
                  {tooltipVisibility[index] && (
                    <span className="absolute text-[0.75rem] leading-none left-10 p-[0.62rem] rounded shadow-xl text-zinc-200 dark:bg-zinc-700 bg-zinc-800">
                      {item.name}
                    </span>
                  )}
                </button>
              )}
            </div>
          );
        })}
        <div className="flex flex-col gap-4">
          {mounted === true && (
            <button
              className="w-full flex justify-center items-center dark:bg-zinc-800 dark:hover:bg-zinc-700 bg-zinc-700 hover:bg-zinc-800 shadow hover:shadow-xl rounded hover:scale-110 duration-300 ease-in-out"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              <div className="p-2 text-zinc-100">{theme === 'dark' ? <FiSun /> : <FiMoon />}</div>
            </button>
          )}
          <button
            className="w-full flex justify-center items-center dark:bg-zinc-800 dark:hover:bg-zinc-700 bg-zinc-700 hover:bg-zinc-800 shadow hover:shadow-xl rounded hover:scale-110 duration-300 ease-in-out"
            //   onClick={() => router.push(item.slug)}
            onClick={query.toggle}
          >
            <div className="p-2">
              <FiCommand size="1rem" className="text-zinc-100" />
            </div>
          </button>
        </div>
      </div>
      <div className="border-r-2 dark:border-zinc-800 border-zinc-500 h-full mt-4"></div>
    </div>
  );
}
