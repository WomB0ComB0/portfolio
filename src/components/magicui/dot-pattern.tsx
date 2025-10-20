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

import { useEffect, useId, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * @interface DotPatternProps
 * @readonly
 * @public
 * @description
 * Props for the {@link DotPattern} component controlling SVG pattern settings.
 * @property {number} [width] - Width of the SVG pattern tile in pixels. Default: 16.
 * @property {number} [height] - Height of the SVG pattern tile in pixels. Default: 16.
 * @property {number} [x] - Horizontal offset of the pattern. Default: 0.
 * @property {number} [y] - Vertical offset of the pattern. Default: 0.
 * @property {number} [cx] - X coordinate of the dot's center within the tile. Default: 1.
 * @property {number} [cy] - Y coordinate of the dot's center within the tile. Default: 1.
 * @property {number} [cr] - Radius of the dot. Default: 0.5.
 * @property {string} [className] - Additional class names for SVG styling.
 * @author Mike Odnis
 * @web
 * @see https://developer.mozilla.org/docs/Web/SVG/Element/pattern
 * @version 1.0.0
 */
interface DotPatternProps {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  cx?: number;
  cy?: number;
  cr?: number;
  className?: string;
}

/**
 * DotPattern displays an animated SVG background of repeated dots, shifting vertically in response
 * to page scroll. It provides a utility pattern overlay for use in interactive or aesthetic backgrounds.
 *
 * @function
 * @public
 * @param {DotPatternProps} props - Configurable properties for pattern size and styling.
 * @param {number} [props.width=16] - Pattern tile width in pixels.
 * @param {number} [props.height=16] - Pattern tile height in pixels.
 * @param {number} [props.x=0] - Pattern horizontal offset.
 * @param {number} [props.y=0] - Pattern vertical offset.
 * @param {number} [props.cx=1] - X coordinate of dot center within tile.
 * @param {number} [props.cy=1] - Y coordinate of dot center within tile.
 * @param {number} [props.cr=0.5] - Radius of the dot.
 * @param {string} [props.className] - Additional CSS classes.
 * @returns {JSX.Element} Fixed-position SVG pattern animated by window scroll.
 * @throws {Error} If used outside of a React DOM environment or if pattern generation fails.
 * @author Mike Odnis
 * @web
 * @see https://github.com/WomB0ComB0/portfolio
 * @see https://developer.mozilla.org/docs/Web/SVG/Element/pattern
 * @example
 *   <DotPattern width={20} height={20} cr={1} className="text-gray-200/50" />
 * @version 1.0.0
 */
export function DotPattern({
  width = 16,
  height = 16,
  x = 0,
  y = 0,
  cx = 1,
  cy = 1,
  cr = 0.5,
  className,
}: DotPatternProps) {
  const id = useId();
  const [scrollPosition, setScrollPosition] = useState(0);

  useEffect(() => {
    /**
     * Handles window scroll event to update vertical pattern translation.
     * @private
     * @see https://developer.mozilla.org/docs/Web/API/Window/scrollY
     */
    const handleScroll = () => {
      setScrollPosition(window.scrollY);
    };

    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <svg
      aria-hidden="true"
      className={cn('fixed inset-0 h-full w-full', className)}
      style={{ transform: `translateY(${scrollPosition * 0.5}px)` }}
    >
      <defs>
        <pattern id={id} width={width} height={height} patternUnits="userSpaceOnUse" x={x} y={y}>
          <circle cx={cx} cy={cy} r={cr} fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

export default DotPattern;
