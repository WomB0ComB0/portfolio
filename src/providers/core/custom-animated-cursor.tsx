'use client';

import dynamic from 'next/dynamic';
import type React from 'react';
import { useEffect, useState } from 'react';
import { COLORS } from '@/constants';

const colors = COLORS;

/**
 * Dynamically imports the AnimatedCursor component from 'react-animated-cursor' with SSR disabled.
 *
 * @constant
 * @readonly
 * @type {React.ComponentType<any>}
 * @see {@link https://www.npmjs.com/package/react-animated-cursor}
 * @web
 */
const AnimatedCursor = dynamic(() => import('react-animated-cursor'), {
  ssr: false,
  loading: () => null,
});

/**
 * `CustomAnimatedCursor` is a React component that renders a customizable, animated
 * cursor for web applications. It cycles through a palette of colors, hides the system
 * cursor over clickable elements, and supports clickables targeting various HTML elements.
 *
 * Color cycling uses a set interval, and cursor styling is injected globally via a <style> element.
 * Hydration- and SSR-safety are considered. Intended for use in portfolio web applications.
 *
 * @function
 * @public
 * @web
 * @author Mike Odnis (@WomB0ComB0)
 * @version 1.0.0
 * @returns {React.ReactElement|null} The animated cursor, or null until after hydration
 * @example
 * <CustomAnimatedCursor />
 * @throws {Error} Will not throw directly, but improper usage or running in unsupported environments may cause runtime errors.
 * @see {@link https://www.npmjs.com/package/react-animated-cursor} Animated Cursor npm
 * @see COLORS {@link ../../constants}
 */
export const CustomAnimatedCursor = (): React.ReactElement | null => {
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [colorIndex, setColorIndex] = useState<number>(0);

  useEffect(() => {
    /**
     * Handles hydration-completion and sets up animated cursor color cycling and
     * global cursor hiding, cleaning up on unmount.
     *
     * @private
     */
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
    }, 500);

    const intervalId = setInterval(() => {
      setColorIndex((prevIndex) => (prevIndex + 1) % colors.length);
    }, 5000);

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
