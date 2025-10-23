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

import { useKBar } from 'kbar';
import Link from 'next/link';
import React, { memo, useState } from 'react';
import { FiCommand } from 'react-icons/fi';
import { Button } from '@/components/ui/button';
import { NavbarItems } from '@/constants/index';

export const NavBar = memo(({ path }: { path: string }) => {
  const { query } = useKBar();
  const [tooltipVisibility, setTooltipVisibility] = useState(
    Array(NavbarItems.length + 1).fill(false),
  );

  return (
    <div className="w-full min-h-full h-full flex flex-col justify-start items-center pt-6">
      <div className="flex flex-col gap-4">
        {NavbarItems.map((item, index) => {
          const isActive = path === item.slug;
          return (
            <div key={item.slug} className="relative group">
              <Button
                asChild
                className={`w-full flex justify-center items-center ${
                  isActive ? 'bg-primary hover:bg-primary/80' : 'bg-card hover:bg-primary/50'
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
                aria-label={`${item.name} link`}
                suppressHydrationWarning
              >
                <Link href={item.slug}>
                  <div className="p-2">
                    <item.icon size="1rem" className="text-accent" />
                  </div>
                </Link>
              </Button>
              {tooltipVisibility[index] && (
                <span className="hidden md:block absolute min-w-max text-sm font-medium leading-none right-[-8rem] top-1/2 -translate-y-1/2 px-3 py-2 rounded-md shadow-lg text-accent bg-card border border-primary z-50 pointer-events-none animate-in fade-in slide-in-from-left-2 duration-200">
                  {item.name}
                  <span className="absolute left-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-card border-l border-b border-primary"></span>
                </span>
              )}
            </div>
          );
        })}
        <div className="flex flex-col gap-4">
          <div className="relative group">
            <Button
              className="w-full flex justify-center items-center bg-card hover:bg-primary/50 shadow hover:shadow-xl rounded hover:scale-110 duration-300 ease-in-out relative"
              onClick={query.toggle}
              onMouseLeave={() => {
                const temp = [...tooltipVisibility];
                temp[NavbarItems.length] = false;
                setTooltipVisibility(temp);
              }}
              onMouseEnter={() => {
                const temp = [...tooltipVisibility];
                temp[NavbarItems.length] = true;
                setTooltipVisibility(temp);
              }}
              aria-label="Open command menu"
              suppressHydrationWarning
            >
              <div className="p-2">
                <FiCommand size="1rem" className="text-accent" />
              </div>
            </Button>
            {tooltipVisibility[NavbarItems.length] && (
              <span className="hidden md:block absolute min-w-max text-sm font-medium leading-none right-[-8rem] top-1/2 -translate-y-1/2 px-3 py-2 rounded-md shadow-lg text-accent bg-card border border-primary z-50 pointer-events-none animate-in fade-in slide-in-from-left-2 duration-200">
                Command Menu
                <span className="absolute left-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-card border-l border-b border-primary"></span>
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="border-r-2 border-accent h-full mt-4"></div>
    </div>
  );
});
NavBar.displayName = 'NavBar';
export default NavBar;
