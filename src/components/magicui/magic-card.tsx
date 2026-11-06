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

import { motion, useMotionTemplate, useMotionValue } from 'motion/react';
import { type ReactElement, type RefObject, useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';
import type { MagicCardProps } from './magic-card.types';

/**
 * The tile surface: a hairline border on surface-1 that strengthens on hover. Callers' classes
 * still win through cn (tailwind-merge), so legacy overrides such as `border-border/50` or
 * `rounded-3xl` keep working.
 */
const CARD_CLASS =
  'group relative flex size-full overflow-hidden rounded-tile border border-hairline bg-surface-1 text-card-foreground transition-colors duration-(--motion-fast) hover:border-hairline-strong';

const SPOTLIGHT_CLASS =
  'pointer-events-none absolute -inset-px rounded-[inherit] opacity-0 transition-opacity duration-(--motion-base) group-hover:opacity-100';

/** The spotlight's diameter, in px. */
const DEFAULT_GRADIENT_SIZE = 200;
/**
 * A translucent brand literal, not color-mix(): the token keeps the spotlight on the palette and
 * faint wherever it is read.
 */
const DEFAULT_GRADIENT_COLOR = 'var(--brand-wash)';
const DEFAULT_GRADIENT_OPACITY = 0.8;

interface SpotlightOverlayProps {
  readonly cardRef: RefObject<HTMLDivElement | null>;
  readonly size: number;
  readonly color: string;
  readonly opacity: number;
}

/**
 * The radial glow that follows the pointer inside the card. It is mounted only while the
 * spotlight is on, so a card without it attaches no listeners and keeps no motion values.
 */
function SpotlightOverlay({ cardRef, size, color, opacity }: SpotlightOverlayProps): ReactElement {
  const mouseX = useMotionValue(-size);
  const mouseY = useMotionValue(-size);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    // Parked a full diameter outside the top-left corner, the glow is out of sight.
    const park = (): void => {
      mouseX.set(-size);
      mouseY.set(-size);
    };
    const follow = (event: MouseEvent): void => {
      const { left, top } = card.getBoundingClientRect();
      mouseX.set(event.clientX - left);
      mouseY.set(event.clientY - top);
    };

    card.addEventListener('mousemove', follow);
    card.addEventListener('mouseleave', park);
    park();

    return () => {
      card.removeEventListener('mousemove', follow);
      card.removeEventListener('mouseleave', park);
    };
  }, [cardRef, mouseX, mouseY, size]);

  const background = useMotionTemplate`radial-gradient(${size}px circle at ${mouseX}px ${mouseY}px, ${color}, transparent 100%)`;

  return (
    <motion.div
      aria-hidden="true"
      data-magic-card-spotlight=""
      className={SPOTLIGHT_CLASS}
      style={{ background, opacity }}
    />
  );
}

/**
 * A card on the Live Console tile surface (hairline border, surface-1) with an optional pointer
 * spotlight.
 *
 * @deprecated Use `Tile` from '@/components/console' instead: variant 'interactive' (the whole
 * tile is one link) or 'linked' (a tile holding one stretched TileLink) for a clickable card,
 * 'plain' or 'raised' otherwise. MagicCard stays only for pages not yet redesigned, and already
 * wears the tile surface so they match the console chrome.
 *
 * @param {MagicCardProps} props - Props for the MagicCard component.
 * @param {React.ReactNode} props.children - Child nodes to render within the MagicCard.
 * @param {string} [props.className] - Classes merged over the tile surface (callers win).
 * @param {number} [props.gradientSize=200] - The diameter of the radial gradient in px.
 * @param {string} [props.gradientColor='var(--brand-wash)'] - The CSS colour of the gradient.
 * @param {number} [props.gradientOpacity=0.8] - Opacity for the gradient overlay.
 * @param {boolean} [props.spotlight=true] - false skips the overlay and its pointer listeners.
 *
 * @example
 * <MagicCard spotlight={false}>
 *   <p>A static card on the tile surface.</p>
 * </MagicCard>
 *
 * @see MagicCardProps
 * @author Mike Odnis
 * @version 1.1.0
 * @public
 */
export const MagicCard = ({
  children,
  className,
  gradientSize = DEFAULT_GRADIENT_SIZE,
  gradientColor = DEFAULT_GRADIENT_COLOR,
  gradientOpacity = DEFAULT_GRADIENT_OPACITY,
  spotlight = true,
}: MagicCardProps): ReactElement => {
  const cardRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={cardRef} className={cn(CARD_CLASS, className)}>
      <div className="relative z-10 w-full h-full">{children}</div>
      {spotlight && (
        <SpotlightOverlay
          cardRef={cardRef}
          size={gradientSize}
          color={gradientColor}
          opacity={gradientOpacity}
        />
      )}
    </div>
  );
};
MagicCard.displayName = 'MagicCard';

export default MagicCard;
