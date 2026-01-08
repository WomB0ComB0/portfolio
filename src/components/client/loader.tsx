'use client';
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

import { motion } from 'framer-motion';
import Icons from '../icons'; // Assuming Icons.logo is your wolf logo component

export const Loader = () => {
  return (
    <div
      className="relative flex items-center justify-center h-screen overflow-hidden"
      style={{ background: 'oklch(var(--background))', isolation: 'isolate' }}
    >
      {/* Opaque backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: 'oklch(var(--background))' }}
      />

      <div className="relative z-10 flex flex-col items-center justify-center">
        <div className="relative flex items-center justify-center">
          {/* Outer rotating ring with particles */}
          <motion.div
            className="absolute w-80 h-80 sm:w-96 sm:h-96"
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          >
            <svg
              className="w-full h-full"
              viewBox="0 0 100 100"
              aria-labelledby="loader-ring-title"
            >
              <title id="loader-ring-title">Loading ring animation</title>
              <defs>
                <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.8" />
                  <stop offset="50%" stopColor="#a855f7" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.4" />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="url(#ringGradient)"
                strokeWidth="1"
                strokeLinecap="round"
                strokeDasharray="283"
                strokeDashoffset="75"
                filter="url(#glow)"
              />
              <motion.circle
                cx="50"
                cy="5"
                r="3"
                fill="#8b5cf6"
                animate={{
                  opacity: [1, 0.7, 1],
                  scale: [1, 1.2, 1],
                  filter: [
                    'drop-shadow(0 0 10px #8b5cf6)',
                    'drop-shadow(0 0 20px #a855f7)',
                    'drop-shadow(0 0 10px #8b5cf6)',
                  ],
                }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              />
              <circle cx="95" cy="50" r="2.5" fill="#a855f7" opacity="1" />
              <circle cx="50" cy="95" r="2" fill="#6366f1" opacity="0.9" />
            </svg>
          </motion.div>

          {/* Middle rotating hexagon */}
          <motion.div
            className="absolute w-56 h-56 sm:w-64 sm:h-64"
            animate={{ rotate: -360 }}
            transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
          >
            <svg
              className="w-full h-full"
              aria-labelledby="hexagon-title"
              viewBox="0 0 100 100"
            >
              <title id="hexagon-title">Rotating hexagon decorative graphic</title>
              <defs>
                <linearGradient id="hexGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#a855f7" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.1" />
                </linearGradient>
              </defs>
              <motion.polygon
                points="50,10 85,30 85,70 50,90 15,70 15,30"
                fill="none"
                stroke="url(#hexGradient)"
                strokeWidth="1"
                animate={{ opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              />
            </svg>
          </motion.div>

          {/* Center logo with enhanced glow effects */}
          <div className="relative">
            {/* Soft radial glow */}
            <motion.div
              className="absolute inset-0 blur-3xl rounded-full"
              style={{
                background:
                  'radial-gradient(circle, rgba(139, 92, 246, 0.6), rgba(168, 85, 247, 0.4), rgba(99, 102, 241, 0.3))',
              }}
              animate={{ opacity: [0.5, 1, 0.5], scale: [0.9, 1.2, 0.9] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
            {/* Upward projecting glow */}
            <motion.div
              className="absolute inset-0 blur-[100px] rounded-full"
              animate={{ opacity: [0.3, 0.7, 0.3], scale: [1, 1.3, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
            />
            {/* Central logo container with floating animation */}
            <motion.div
              className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-3xl flex items-center justify-center shadow-2xl"
              animate={{ y: [0, -15, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <motion.div
                animate={{
                  opacity: [1, 0.8, 1],
                  scale: [1, 1.05, 1],
                  filter: [
                    'drop-shadow(0 0 15px #8b5cf6)',
                    'drop-shadow(0 0 25px #a855f7)',
                    'drop-shadow(0 0 15px #8b5cf6)',
                  ],
                }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Icons.logo className="w-16 h-16 sm:w-20 sm:h-20 text-white" />
              </motion.div>
            </motion.div>
          </div>

          {/* Orbiting elements */}
          <div className="absolute w-[380px] h-[380px] sm:w-[420px] sm:h-[420px]">
            <motion.div
              className="absolute top-0 left-1/2 w-3 h-3 rounded-full shadow-lg"
              style={{
                background: 'linear-gradient(to right, #8b5cf6, #a855f7)',
                boxShadow: '0 0 20px #8b5cf6',
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
            />
            <motion.div
              className="absolute right-0 top-1/2 w-3 h-3 rounded-full shadow-lg"
              style={{
                background: 'linear-gradient(to right, #a855f7, #6366f1)',
                boxShadow: '0 0 20px #a855f7',
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 7, repeat: Infinity, ease: 'linear' }}
            />
            <motion.div
              className="absolute bottom-0 left-1/2 w-3 h-3 rounded-full shadow-lg"
              style={{
                background: 'linear-gradient(to right, #6366f1, #8b5cf6)',
                boxShadow: '0 0 20px #6366f1',
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            />
            <motion.div
              className="absolute left-0 top-1/2 w-3 h-3 rounded-full shadow-lg"
              style={{
                background: 'linear-gradient(to right, #c084fc, #a855f7)',
                boxShadow: '0 0 20px #c084fc',
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

Loader.displayName = 'Loader';

export default Loader;
