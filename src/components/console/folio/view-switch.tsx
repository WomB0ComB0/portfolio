/**
 * Copyright 2026 Mike Odnis
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
 * @file ViewSwitch: a page's views as a segmented pair (or more) of plain links, the current one
 * marked aria-current="page", in the style of Places | Photos (places-view-nav). Generic over the
 * views and server-safe (no directive, no hooks): it draws the hrefs it is given, so it works
 * without JavaScript.
 *
 * Each link is rel="nofollow": another view is the same content arranged differently, and
 * robots.txt closes the `view` parameter. People follow it as any other link.
 *
 * The hrefs carry the filters across (viewHref / viewLinks). A server page builds them from its
 * searchParams. Inside a FilterBar, whose chips change the URL in place without a server render,
 * a small client island builds them from the bar's live state (useFilterBar().model.active and the
 * schema's serialize), as PlacesViewNav does, and renders this.
 *
 * Palette only: a surface-1 track with a hairline, the current view on brand-subtle with a
 * brand-edge rim. The label colour flips at once; only a press moves (scale, on the house spring).
 */

import Link from 'next/link';
import type { ReactElement } from 'react';

import { cn } from '@/lib/utils';
import type { ViewSwitchItem } from './view-href';

/**
 * Never wider than its column: with text at 200% in a 320px window the pair was 4px too wide, so
 * the links' padding tightens with the container (14px down to 10px at the default text size) and,
 * as a last resort, the second link wraps under the first instead of the page scrolling sideways.
 * The links grow: sized to their words the pair has no room to grow into, so they keep the places
 * look; wrapped, each fills its row, so the stack reads as even segments.
 */
const NAV_CLASS =
  'inline-flex max-w-full flex-none flex-wrap gap-1 rounded-[0.625rem] bg-surface-1 p-1 shadow-[inset_0_0_0_1px_var(--hairline)]';
/**
 * 36px tall under a mouse, 44px under a finger (the site's touch target).
 * transition-[scale] replaces the base link's colour fade, so the colour flips at once and only
 * the press moves. Forced colours drop the fill and rim: the current view takes the system
 * highlight, and each link keeps a button's border.
 */
const LINK_CLASS = [
  'inline-flex min-h-9 grow items-center justify-center rounded-[0.4375rem] px-[clamp(0.625rem,3cqi,0.875rem)] tile-label text-muted-foreground no-underline pointer-coarse:min-h-11',
  'transition-[scale] duration-(--motion-spring-out) ease-spring hover:text-foreground',
  'active:scale-[0.96] active:duration-(--motion-instant) motion-reduce:active:scale-100',
  'aria-[current=page]:bg-brand-subtle aria-[current=page]:text-foreground aria-[current=page]:shadow-[inset_0_0_0_1px_var(--brand-edge)]',
  'forced-colors:border forced-colors:border-[color:ButtonBorder]',
  'forced-colors:aria-[current=page]:border-[color:Highlight] forced-colors:aria-[current=page]:bg-[color:Highlight] forced-colors:aria-[current=page]:text-[color:HighlightText] forced-colors:aria-[current=page]:[forced-color-adjust:none]',
].join(' ');

export interface ViewSwitchProps<V extends string> {
  /** The views in order, each with its href (viewLinks builds them). */
  readonly views: readonly ViewSwitchItem<V>[];
  /** The view on screen, marked aria-current="page". */
  readonly current: V;
  /** The switch's name for assistive tech: 'Project views'. */
  readonly label: string;
  readonly className?: string;
}

/**
 * The segmented switch between a page's views. Draws nothing with fewer than two views.
 *
 * @example
 * <ViewSwitch
 *   label="Project views"
 *   current={view}
 *   views={viewLinks(`/projects${toSearch(searchParams)}`, VIEWS, { defaultView: 'stories' })}
 * />
 */
export function ViewSwitch<V extends string>({
  views,
  current,
  label,
  className,
}: ViewSwitchProps<V>): ReactElement | null {
  if (views.length < 2) return null;
  return (
    <nav aria-label={label} data-view-switch="" className={cn(NAV_CLASS, className)}>
      {views.map(({ value, label: viewLabel, href }) => (
        <Link
          key={value}
          href={href}
          prefetch={false}
          rel="nofollow"
          data-view={value}
          className={LINK_CLASS}
          aria-current={value === current ? 'page' : undefined}
        >
          {viewLabel}
        </Link>
      ))}
    </nav>
  );
}
