'use client';

import dynamic from 'next/dynamic';
import React, { useEffect, useState } from 'react';
import { COLORS } from '@/constants';

const colors = COLORS;

// Dynamically import AnimatedCursor with no SSR
const AnimatedCursor = dynamic(() => import('react-animated-cursor'), {
  ssr: false,
  loading: () => null,
});

export const CustomAnimatedCursor = () => {
  const [isMounted, setIsMounted] = useState(false);
  const [colorIndex, setColorIndex] = useState(0);

  useEffect(() => {
    // Wait for hydration to complete AND initial render to finish
    // This prevents the cursor library from modifying DOM during hydration
    const timer = setTimeout(() => {
      setIsMounted(true);
      // Add a global style to hide default cursor once animated cursor is ready
      const style = document.createElement('style');
      style.id = 'animated-cursor-style';
      style.textContent = `
        body.cursor-initialized a,
        body.cursor-initialized button,
        body.cursor-initialized input,
        body.cursor-initialized select,
        body.cursor-initialized textarea,
        body.cursor-initialized label[for],
        body.cursor-initialized .link,
        body.cursor-initialized .custom {
          cursor: none !important;
        }
      `;
      if (!document.getElementById('animated-cursor-style')) {
        document.head.appendChild(style);
      }
    }, 500); // Increased delay to ensure hydration is complete

    const intervalId = setInterval(() => {
      setColorIndex((prevIndex) => (prevIndex + 1) % colors.length);
    }, 5000); // Change color every 5 seconds

    return () => {
      clearTimeout(timer);
      clearInterval(intervalId);
      // Clean up the style when component unmounts
      const style = document.getElementById('animated-cursor-style');
      if (style) {
        style.remove();
      }
    };
  }, []);

  // Don't render anything until mounted (after hydration)
  if (!isMounted) return null;

  return (
    <AnimatedCursor
      innerSize={8}
      outerSize={35}
      innerScale={1}
      outerScale={2}
      outerAlpha={0}
      outerStyle={{
        border: `3px solid ${colors[colorIndex]}`,
        mixBlendMode: 'exclusion',
      }}
      innerStyle={{
        backgroundColor: colors[colorIndex],
      }}
      clickables={[
        'a',
        'input[type="text"]',
        'input[type="email"]',
        'input[type="number"]',
        'input[type="submit"]',
        'input[type="image"]',
        'label[for]',
        'select',
        'textarea',
        'button',
        '.link',
        {
          target: '.custom',
          innerSize: 12,
          outerSize: 12,
          color: colors[colorIndex],
          outerAlpha: 0.3,
          innerScale: 0.7,
          outerScale: 5,
        },
      ]}
    />
  );
};
CustomAnimatedCursor.displayName = 'CustomAnimatedCursor';
export default CustomAnimatedCursor;
