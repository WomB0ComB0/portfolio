'use client';

import React, { useEffect, useState } from 'react';
import AnimatedCursor from 'react-animated-cursor';
import { COLORS } from '@/constants';

const colors = COLORS;

export const CustomAnimatedCursor = () => {
  const [isClient, setIsClient] = useState(false);
  const [colorIndex, setColorIndex] = useState(0);

  useEffect(() => {
    setIsClient(true);
    const intervalId = setInterval(() => {
      setColorIndex((prevIndex) => (prevIndex + 1) % colors.length);
    }, 5000); // Change color every 5 seconds

    return () => clearInterval(intervalId);
  }, []);

  if (!isClient) return null;

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
