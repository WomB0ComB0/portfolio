'use client';

import { MeshGradient } from '@paper-design/shaders-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';

interface ShaderBackgroundProps {
  children: React.ReactNode;
}

export const ShaderBackground = ({ children }: ShaderBackgroundProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [, setIsActive] = useState(false);

  useEffect(() => {
    const handleMouseEnter = () => setIsActive(true);
    const handleMouseLeave = () => setIsActive(false);

    const container = containerRef.current;
    if (container) {
      container.addEventListener('mouseenter', handleMouseEnter);
      container.addEventListener('mouseleave', handleMouseLeave);
    }

    return () => {
      if (container) {
        container.removeEventListener('mouseenter', handleMouseEnter);
        container.removeEventListener('mouseleave', handleMouseLeave);
      }
    };
  }, []);

  // Get CSS variable colors - convert oklch to hex approximations
  const getThemeColors = () => {
    // SSR fallback
    if (typeof window === 'undefined') {
      return {
        bg: '#121018', // softer than #0a0a0a
        colors: ['#0f0b17', '#201428', '#3f2a66', '#271a3b', '#54358d'],
      };
    }

    // Client palette (no white, no pure black)
    return {
      bg: '#121018',
      colors: ['#0f0b17', '#22162c', '#533589', '#2a1b40', '#3a255c'],
    };
  };

  const { bg, colors } = getThemeColors();

  return (
    <div ref={containerRef} className="min-h-screen bg-background relative overflow-hidden">
      {/* SVG Filters */}
      <svg className="absolute inset-0 w-0 h-0" aria-hidden="true" focusable="false">
        <title>SVG filter definitions (decorative)</title>
        <defs>
          <filter id="glass-effect" x="-50%" y="-50%" width="200%" height="200%">
            <feTurbulence baseFrequency="0.005" numOctaves="1" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.3" />
            <feColorMatrix
              type="matrix"
              values="1 0 0 0 0.02
                      0 1 0 0 0.02
                      0 0 1 0 0.05
                      0 0 0 0.9 0"
              result="tint"
            />
          </filter>
          <filter id="gooey-filter" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"
              result="gooey"
            />
            <feComposite in="SourceGraphic" in2="gooey" operator="atop" />
          </filter>
        </defs>
      </svg>

      <MeshGradient
        className="absolute inset-0 w-full h-full"
        colors={colors}
        speed={0.3}
        style={{ backgroundColor: bg }}
      />
      <MeshGradient
        className="absolute inset-0 w-full h-full opacity-55"
        colors={['#15101f', '#241832', '#533589', '#1b1326']}
        speed={0.22}
        style={{ backgroundColor: 'transparent' }}
      />

      {/* Fallback gradient background */}
      <div
        className="absolute inset-0 w-full h-full"
        style={{
          background: `radial-gradient(circle at 30% 50%, oklch(var(--primary) / 0.10), transparent 50%),
               radial-gradient(circle at 70% 30%, oklch(var(--accent) / 0.08), transparent 50%),
               radial-gradient(circle at 50% 70%, oklch(var(--muted) / 0.07), transparent 50%),
               oklch(var(--background))`,
        }}
        aria-hidden="true"
      />

      <div className="relative z-10">{children}</div>
    </div>
  );
};
ShaderBackground.displayName = 'ShaderBackground';
export default ShaderBackground;
