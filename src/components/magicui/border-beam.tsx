import type { BorderBeamProps } from './border-beam.types';
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

import { cn } from '@/lib/utils';
/**
 * BorderBeam renders an animated border highlight ("beam") around its container using CSS variables and pseudo-elements.
 *
 * This component is useful for drawing visual attention to UI elements by adding a dynamic border effect. It leverages CSS custom properties for full style control.
 *
 * @function
 * @public
 * @param {BorderBeamProps} props - Properties for configuring the border beam.
 * @param {string} [props.className] - Additional class names for the container.
 * @param {number} [props.size=200] - Diameter of the animation beam (pixels).
 * @param {number} [props.duration=15] - Animation duration in seconds.
 * @param {number} [props.anchor=90] - Anchor position for animation path (percentage).
 * @param {number} [props.borderWidth=1.5] - Width of the border in pixels.
 * @param {string} [props.colorFrom='#ffaa40'] - Gradient starting color.
 * @param {string} [props.colorTo='#9c40ff'] - Gradient ending color.
 * @param {number} [props.delay=0] - Animation delay in seconds.
 *
 * @returns {JSX.Element} A div element styled to show an animated border beam on its parent.
 *
 * @throws {Error} May throw if provided properties are of the wrong type or if custom CSS properties are unsupported.
 *
 * @example
 * <div className="relative rounded-xl overflow-hidden">
 *   <BorderBeam size={180} colorFrom="#FFDD57" colorTo="#8A2BE2" duration={12} />
 *   <button className="relative z-10 px-8 py-3 bg-gray-950 text-white rounded-xl">Hello World</button>
 * </div>
 *
 * @author Mike Odnis
 * @web
 * @see https://github.com/WomB0ComB0/portfolio
 * @see https://developer.mozilla.org/docs/Web/CSS/--*
 * @see https://developer.mozilla.org/docs/Web/CSS/CSS_Custom_Properties
 * @version 1.0.0
 */
export const BorderBeam = ({
  className,
  size = 200,
  duration = 15,
  anchor = 90,
  borderWidth = 1.5,
  colorFrom = '#ffaa40',
  colorTo = '#9c40ff',
  delay = 0,
}: BorderBeamProps) => {
  return (
    <div
      style={
        {
          '--size': size,
          '--duration': duration,
          '--anchor': anchor,
          '--border-width': borderWidth,
          '--color-from': colorFrom,
          '--color-to': colorTo,
          '--delay': `-${delay}s`,
        } as React.CSSProperties
      }
      className={cn(
        'pointer-events-none absolute inset-0 rounded-[inherit] [border:calc(var(--border-width)*1px)_solid_transparent]',
        // mask styles
        '[mask-clip:padding-box,border-box]! mask-intersect! [mask:linear-gradient(transparent,transparent),linear-gradient(white,white)]',
        // pseudo styles
        'after:absolute after:aspect-square after:w-[calc(var(--size)*1px)] after:animate-border-beam after:[animation-delay:var(--delay)] after:[background:linear-gradient(to_left,var(--color-from),var(--color-to),transparent)] after:[offset-anchor:calc(var(--anchor)*1%)_50%] after:[offset-path:rect(0_auto_auto_0_round_calc(var(--size)*1px))]',
        className,
      )}
    />
  );
};
BorderBeam.displayName = 'BorderBeam';

export default BorderBeam;
