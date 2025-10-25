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

import type React from 'react';
import { useEffect, useState } from 'react';
import Icons from '../icons';

new Promise<void>((resolve) => {
  setTimeout(() => resolve(), 3000);
});

export const Loader: React.FC = () => {
  const [, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : `${prev}.`));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative flex items-center justify-center h-screen bg-background overflow-hidden">
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.02]" />

      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-chart-1/20 rounded-full blur-[120px] animate-pulse delay-1000" />

      <div className="relative z-10 flex flex-col items-center justify-center gap-8">
        <div className="relative flex items-center justify-center">
          {/* Outer rotating ring */}
          <div className="absolute w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48">
            <svg className="w-full h-full animate-spin-slow" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="2"
                strokeDasharray="70 200"
                strokeLinecap="round"
                opacity="0.3"
              />
            </svg>
          </div>

          {/* Inner counter-rotating ring */}
          <div className="absolute w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40">
            <svg className="w-full h-full animate-spin-reverse" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="hsl(var(--chart-1))"
                strokeWidth="2"
                strokeDasharray="50 200"
                strokeLinecap="round"
                opacity="0.5"
              />
            </svg>
          </div>

          {/* Logo with glow effect */}
          <div className="relative">
            <div className="absolute inset-0 blur-xl bg-primary/30 rounded-full animate-pulse" />
            <Icons.logo
              className="relative select-none h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24 drop-shadow-2xl"
              props={{
                width: 96,
                height: 96,
                type: 'image/svg+xml',
                'aria-label': 'Loading...',
              }}
            />
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 text-muted-foreground font-mono text-sm">
            <span className="text-primary">{'<'}</span>
            <span className="animate-pulse">Loading</span>
            <span className="text-primary">{'/>'}</span>
          </div>
          <div className="flex items-center gap-1 h-6">
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce" />
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce delay-150" />
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce delay-300" />
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes spin-reverse {
          from {
            transform: rotate(360deg);
          }
          to {
            transform: rotate(0deg);
          }
        }
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
        .animate-spin-reverse {
          animation: spin-reverse 4s linear infinite;
        }
        .delay-150 {
          animation-delay: 150ms;
        }
        .delay-300 {
          animation-delay: 300ms;
        }
        .delay-1000 {
          animation-delay: 1000ms;
        }
        .bg-grid-pattern {
          background-image:
            linear-gradient(hsl(var(--border)) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px);
          background-size: 50px 50px;
        }
      `}</style>
    </div>
  );
};

Loader.displayName = 'Loader';
export default Loader;
