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
 *   It must not contain other links or buttons. With no destination (see hasDestination) it
 *   renders as `plain`, so a tile never looks clickable without going anywhere.
 * - `linked`: a plain element (marked `data-linked-tile`) that holds exactly one stretched
 *   <TileLink>; other links may sit above its overlay with `relative z-10`. The tile draws the
 *   focus ring for its TileLink only.
 *
 * Only `interactive` and `linked` lift on hover and carry `data-spotlight`, which SpotlightRoot
 * reads to move the `spotlight` glow under the pointer.
 */

import { cva } from 'class-variance-authority';
import Link from 'next/link';
import type { AnchorHTMLAttributes, HTMLAttributes, ReactElement, ReactNode } from 'react';

import { type TileSpan, tileSpanClass } from '@/components/console/tile-grid';
import { hasDestination, NEW_TAB_LABEL, SrOnlyWords } from '@/components/console/tile-link';
import { cn } from '@/lib/utils';

/**
 * The hover lift shared by `interactive` and `linked`. Tailwind v4's translate utilities set the
 * `translate` property, so that (not `transform`) is what transitions. The lift shadow lives on
 * `::after` behind the tile (`-z-10` needs the tile's `isolate`) so only its opacity animates.
 */
const LIFT_CLASS =
  'spotlight border-hairline bg-surface-1 transition-[translate,border-color] duration-(--motion-fast) ease-out-expo hover:-translate-y-0.5 hover:border-hairline-strong active:translate-y-0 motion-reduce:hover:translate-y-0 after:pointer-events-none after:absolute after:inset-0 after:-z-10 after:rounded-[inherit] after:shadow-lift after:opacity-0 after:transition-opacity after:duration-(--motion-base) hover:after:opacity-100';

/**
 * A `linked` tile rings itself while its TileLink (`data-tile-link`) has keyboard focus. Keyed on
 * that attribute, not on any anchor, so a secondary `relative z-10` link shows only its own ring.
 */
const LINK_FOCUS_RING_CLASS =
  'has-[[data-tile-link]:focus-visible]:outline-2 has-[[data-tile-link]:focus-visible]:outline-offset-2 has-[[data-tile-link]:focus-visible]:outline-focus';

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
        interactive: LIFT_CLASS,
        linked: `${LIFT_CLASS} ${LINK_FOCUS_RING_CLASS}`,
      },
      tone: {
        default: '',
        hero: 'bg-[linear-gradient(160deg,color-mix(in_oklch,var(--brand)_14%,var(--surface-1)),var(--surface-1)_60%)]',
      },
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
/** `hero` washes the top-left corner with brand; it is drawn for the surface-1 variants. */
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
  /** Opens in a new tab (a plain anchor with rel="noopener noreferrer"). */
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
  if (hasDestination(props.href)) return <InteractiveTile {...props} />;
  return <StaticTile {...plainTileProps(props)} />;
}
