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

/**
 * @file The Live Console tile: the surface every console section sits on. Server-safe (no
 * directive, no hooks), so server components render it as is.
 *
 * Four variants:
 * - `plain`: a hairline-bordered surface.
 * - `raised`: one step lighter with a shadow, for popovers and emphasis.
 * - `interactive`: the whole tile is ONE link (next/link, or a new-tab anchor when `external`).
 *   It must not contain other links or buttons. With no destination (see destinationOf) it
 *   renders as `plain`, so a tile never looks clickable without going anywhere.
 * - `linked`: a plain element (marked `data-linked-tile`) that holds exactly one stretched
 *   <TileLink>; other links may sit above its overlay with `relative z-10`. The tile draws the
 *   focus ring for its TileLink only.
 *
 * Only `interactive` and `linked` lift on hover and carry `data-spotlight`, which SpotlightRoot
 * reads to move the `spotlight` glow under the pointer. The hover is the one the owner picked in
 * the Fluid UI Lab (2026-11-08): lane B's spring motion with the old home cards' (#601) colours.
 */

import { cva } from 'class-variance-authority';
import Link from 'next/link';
import type { AnchorHTMLAttributes, HTMLAttributes, ReactElement, ReactNode } from 'react';

import { type TileSpan, tileSpanClass } from '@/components/console/tile-grid';
import { destinationOf, NEW_TAB_LABEL, SrOnlyWords } from '@/components/console/tile-link';
import { cn } from '@/lib/utils';

/**
 * The move of the hover shared by `interactive` and `linked`: a 3 px lift on translate only, on the
 * no-bounce spring, entering in --motion-spring-in and leaving in --motion-spring-out (CSS runs the
 * transition of the state being entered, so the rest rule times the way back). The hovered tile is
 * raised over its neighbours at once, and drops back only after --motion-slow, once its light has
 * faded; z-index steps (0 s, linear) rather than interpolating, and rests at 0, not auto, which
 * could not take the delay. A press drops back in --motion-instant. Tailwind v4's translate
 * utilities set the `translate` property, so that (not `transform`) is what transitions.
 */
const LIFT_MOVE_CLASS = [
  'z-0 transition-[translate,z-index] ease-[var(--ease-spring),linear]',
  'duration-[var(--motion-spring-out),0s] delay-[0s,var(--motion-slow)]',
  'hover:z-1 hover:-translate-y-0.75 hover:duration-[var(--motion-spring-in),0s] hover:delay-0',
  'active:translate-y-0 active:duration-(--motion-instant)',
  'motion-reduce:hover:translate-y-0',
].join(' ');

/**
 * The light of the hover: ONE `::after` layer over the tile's border box, behind its glow and
 * content (`-z-10` needs the tile's `isolate`), carrying the brand rim and halo (--shadow-lift).
 * Only its opacity animates, on --ease-effect: in over --motion-base, out over --motion-slow. The
 * `spotlight` glow (::before) fades on the same timing, so lift, light and glow start together.
 */
const LIFT_LIGHT_CLASS = [
  'after:pointer-events-none after:absolute after:-inset-px after:-z-10 after:rounded-[inherit]',
  'after:shadow-lift after:opacity-0',
  'after:transition-opacity after:ease-effect after:duration-(--motion-slow)',
  'hover:after:opacity-100 hover:after:duration-(--motion-base)',
].join(' ');

/** The hover shared by `interactive` and `linked`. */
const LIFT_CLASS = `spotlight border-hairline bg-surface-1 ${LIFT_MOVE_CLASS} ${LIFT_LIGHT_CLASS}`;

/**
 * Keyboard focus reaches the hover's end state at once: the light and the raise, with no
 * animation (no lift and no glow; neither follows a keyboard). Leaving focus fades the light out
 * like a hover does. `interactive` is focused itself; `linked` holds the focused TileLink.
 */
const INTERACTIVE_FOCUS_LIGHT_CLASS =
  'focus-visible:z-1 focus-visible:delay-0 focus-visible:after:opacity-100 focus-visible:after:duration-0';

const LINK_FOCUS_LIGHT_CLASS =
  'has-[[data-tile-link]:focus-visible]:z-1 has-[[data-tile-link]:focus-visible]:delay-0 has-[[data-tile-link]:focus-visible]:after:opacity-100 has-[[data-tile-link]:focus-visible]:after:duration-0';

/**
 * A `linked` tile rings itself while its TileLink (`data-tile-link`) has keyboard focus. Keyed on
 * that attribute, not on any anchor, so a secondary `relative z-10` link shows only its own ring.
 */
const LINK_FOCUS_RING_CLASS =
  'has-[[data-tile-link]:focus-visible]:outline-2 has-[[data-tile-link]:focus-visible]:outline-offset-2 has-[[data-tile-link]:focus-visible]:outline-focus';

/**
 * The `hero` wash: translucent brand fading to transparent, painted as a background-image over
 * the variant's own background colour, so a raised tile keeps its surface-2 and a plain one its
 * surface-1. --brand-wash is a literal with alpha, not color-mix(): Tailwind's fallback for
 * browsers without color-mix would paint full-strength brand. One literal class, so Tailwind's
 * scanner sees it.
 */
const HERO_WASH_CLASS = 'bg-[linear-gradient(160deg,var(--brand-wash),transparent_60%)]';

/**
 * Tile classes. The root is an inline-size container (`@container`), so content inside a tile
 * sizes itself with `@sm:`/`@md:` against the tile's own width. The padding step (`@md:p-5`) sits
 * on the tile itself, so it answers to the nearest ANCESTOR container instead (a TileGrid's).
 */
export const tileVariants = cva(
  'group/tile relative isolate flex min-w-0 flex-col rounded-tile border text-foreground @container',
  {
    variants: {
      variant: {
        plain: 'border-hairline bg-surface-1',
        raised: 'border-hairline bg-surface-2 shadow-raised',
        interactive: `${LIFT_CLASS} ${INTERACTIVE_FOCUS_LIGHT_CLASS}`,
        linked: `${LIFT_CLASS} ${LINK_FOCUS_LIGHT_CLASS} ${LINK_FOCUS_RING_CLASS}`,
      },
      tone: { default: '', hero: HERO_WASH_CLASS },
      padding: {
        none: 'p-0',
        sm: 'p-3',
        md: 'p-4 @md:p-5',
        lg: 'p-6 @md:p-8',
      },
    },
    defaultVariants: { variant: 'plain', tone: 'default', padding: 'md' },
  },
);

export type TileVariant = 'plain' | 'raised' | 'interactive' | 'linked';
/** `hero` washes the top-left corner with translucent brand over the variant's own surface. */
export type TileTone = 'default' | 'hero';
export type TilePadding = 'none' | 'sm' | 'md' | 'lg';
/** Elements a non-link tile can render as. Use `li` inside `<TileGrid as="ul">`. */
export type TileElement = 'div' | 'section' | 'article' | 'li' | 'aside';

interface TileOwnProps {
  tone?: TileTone;
  padding?: TilePadding;
  /** Grid placement inside a TileGrid. Left out, the tile gets no span classes at all. */
  span?: TileSpan;
  className?: string;
  children?: ReactNode;
}

/**
 * A `plain`, `raised` or `linked` tile: an element, not a link. The link props are `never` so the
 * union stays closed: without them, TypeScript accepts `<Tile href="/x">` (variant left out) and
 * the href lands on a div that is not a link.
 */
export interface StaticTileProps
  extends TileOwnProps,
    Omit<HTMLAttributes<HTMLElement>, keyof TileOwnProps> {
  variant?: Exclude<TileVariant, 'interactive'>;
  as?: TileElement;
  href?: never;
  external?: never;
  prefetch?: never;
}

/** An `interactive` tile: the whole tile is one link. */
export interface InteractiveTileProps
  extends TileOwnProps,
    Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof TileOwnProps | 'href' | 'target' | 'rel'> {
  variant: 'interactive';
  href: string;
  /**
   * Opens in a new tab (a plain anchor with rel="noopener noreferrer") and says so to screen
   * readers. Sighted readers need the aria-hidden ArrowUpRight too, placed by the content, which
   * knows where it fits: StatTile draws it at the end of its head row.
   */
  external?: boolean;
  /** Internal links only. Off by default: a page of tiles would prefetch every target at once. */
  prefetch?: boolean;
}

export type TileProps = StaticTileProps | InteractiveTileProps;

interface TileClassOptions extends Pick<TileOwnProps, 'tone' | 'padding' | 'span' | 'className'> {
  variant?: TileVariant;
}

const tileClassName = ({ span, className, ...variants }: TileClassOptions): string =>
  cn(tileVariants(variants), span && tileSpanClass(span), className);

/**
 * The props of an interactive tile that has nowhere to go, as the plain tile it renders instead:
 * no link props and no lift or spotlight. StatTile uses it too, to keep its labelled root.
 */
export function plainTileProps({
  variant: _variant,
  href: _href,
  external: _external,
  prefetch: _prefetch,
  ...rest
}: InteractiveTileProps): StaticTileProps {
  return { ...rest, variant: 'plain' };
}

function StaticTile({
  variant = 'plain',
  tone,
  padding,
  span,
  as: Root = 'div',
  className,
  children,
  ...rest
}: StaticTileProps): ReactElement {
  return (
    <Root
      {...rest}
      data-spotlight={variant === 'linked' ? '' : undefined}
      data-linked-tile={variant === 'linked' ? '' : undefined}
      className={tileClassName({ variant, tone, padding, span, className })}
    >
      {children}
    </Root>
  );
}

function InteractiveTile({
  variant,
  tone,
  padding,
  span,
  href,
  external = false,
  prefetch = false,
  className,
  children,
  ...rest
}: InteractiveTileProps): ReactElement {
  const linkClassName = tileClassName({ variant, tone, padding, span, className });
  if (external) {
    return (
      <a
        {...rest}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        data-spotlight=""
        className={linkClassName}
      >
        {children}
        <SrOnlyWords>{NEW_TAB_LABEL}</SrOnlyWords>
      </a>
    );
  }
  return (
    <Link {...rest} href={href} prefetch={prefetch} data-spotlight="" className={linkClassName}>
      {children}
    </Link>
  );
}

/**
 * A console tile. See the file comment for the variants.
 *
 * The tile is an inline-size container, so its width must come from its parent (a grid track, a
 * block box, `flex-1`); as a content-sized flex item it would shrink to its padding.
 *
 * `className` merges last, so it wins a conflict with an unprefixed class, but it does not
 * replace the padding: tailwind-merge keeps a variant-prefixed class such as `@md:p-5` next to a
 * caller's `p-0`, and above that container width the tile would still be padded. Change padding
 * with the `padding` prop (`padding="none"` for a flush tile), never through className.
 *
 * @example
 * <Tile as="article" span={{ lg: 6, rows: 2 }} aria-labelledby="now-heading">...</Tile>
 * <Tile variant="interactive" href="/projects">...</Tile>
 * <Tile variant="linked"><TileLink href="/places">Places</TileLink> ...</Tile>
 */
export function Tile(props: TileProps): ReactElement {
  if (props.variant !== 'interactive') return <StaticTile {...props} />;
  const destination = destinationOf(props.href);
  if (destination === null) return <StaticTile {...plainTileProps(props)} />;
  return <InteractiveTile {...props} href={destination} />;
}
