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
 * @file Two small parts the ledger row, its hover card and the detail page share: a role's
 * period as text (months in <time>, the en dash read as "to"), and the organization's mark (its
 * logo, or a monogram where Studio has none). No directive and no hooks: server rows and the
 * client card both render them. Palette tokens only.
 */

import type { ReactElement } from 'react';
import Image from '@/components/ui/cdn-image';

import { cn } from '@/lib/utils';
import { PRESENT_LABEL, RANGE_SEPARATOR, type RoleMonth, type RolePeriod } from '../_lib/period';

const Month = ({ month }: { readonly month: RoleMonth }): ReactElement => (
  <time dateTime={month.iso}>{month.label}</time>
);

/**
 * 'Mar 2026 – Present' with each month in a <time>. The dash is hidden from screen readers,
 * which hear "to" instead; a role inside one month is that month once.
 */
export function RolePeriodText({ period }: { readonly period: RolePeriod }): ReactElement {
  const { start, end } = period;
  const last = end ? <Month month={end} /> : PRESENT_LABEL;
  if (!start) return <>{last}</>;
  if (end && end.iso === start.iso) return <Month month={start} />;
  return (
    <>
      <Month month={start} />
      <span aria-hidden="true">{RANGE_SEPARATOR}</span>
      {/* select-none: a copied period is what is seen ('Mar 2026 – Present'), without "to". */}
      <span className="sr-only select-none"> to </span>
      {last}
    </>
  );
}

export type RoleMarkSize = 'sm' | 'md' | 'lg';

/**
 * The mark's box per size: 20px in a row, 40px on the hover card, the detail page and a story
 * stop, 56px beside the story's lead role.
 */
const MARK_BOX: Readonly<Record<RoleMarkSize, string>> = {
  sm: 'size-5 rounded-[0.3125rem] text-[0.6875rem]',
  md: 'size-10 rounded-[0.625rem] text-base',
  lg: 'size-14 rounded-[0.875rem] text-xl',
};
const MARK_PX: Readonly<Record<RoleMarkSize, number>> = { sm: 20, md: 40, lg: 56 };
/**
 * A logo at rest, quiet but whole: grey at full strength, with its highlights capped at the muted
 * text tone. A layer in that tone over the logo, blended with "darken", lowers only what is
 * brighter than it: a white tile stops being the brightest thing in its row (never brighter than
 * the muted organization name on a role page), while a dark mark keeps every detail it has. With
 * no fade and no lift, a mark at rest is never brighter than the same mark in its own colours: a
 * fade would lighten a dark mark towards the tile, a lift would brighten every mark.
 *
 * Measured on the eleven logos (mean luminance at rest against pointed at), CodePath 0.36 against
 * 0.79, Social PayMe 0.034 against 0.041. The caller fades the layer out (before:opacity-0) and
 * the grey (grayscale-0) where the logo shows as drawn. Forced colours would paint the layer as
 * the page's own background, which "darken" would turn into a blank, so it is not drawn there.
 */
export const LOGO_AT_REST_CLASS = [
  'data-role-logo:isolate data-role-logo:opacity-100',
  "data-role-logo:before:pointer-events-none data-role-logo:before:absolute data-role-logo:before:inset-0 data-role-logo:before:content-['']",
  'data-role-logo:before:bg-muted-foreground data-role-logo:before:mix-blend-darken',
  'data-role-logo:before:transition-opacity data-role-logo:before:duration-(--motion-base) data-role-logo:before:ease-effect',
  'forced-colors:before:hidden',
].join(' ');

/** surface-2 under the logo (a transparent PNG never sits on nothing) and a hairline rim over it. */
const MARK_CLASS =
  "relative inline-flex flex-none items-center justify-center overflow-hidden bg-surface-2 font-semibold leading-none text-muted-foreground after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:shadow-[inset_0_0_0_1px_var(--hairline)] after:content-['']";

export interface RoleMarkProps {
  /** A square logo URL; null for the monogram. */
  readonly logo: string | null;
  readonly monogram: string;
  readonly size?: RoleMarkSize;
  readonly className?: string;
}

/**
 * The organization's logo, or its monogram. Decorative (the name is always beside it), so the
 * image has empty alt text and the monogram is hidden from screen readers. The logo goes
 * through next/image: CSP img-src is 'self', so Sanity's CDN is never hit from the page.
 */
export function RoleMark({ logo, monogram, size = 'sm', className }: RoleMarkProps): ReactElement {
  if (logo) {
    return (
      <span data-role-logo="" className={cn(MARK_CLASS, MARK_BOX[size], className)}>
        <Image
          src={logo}
          alt=""
          width={MARK_PX[size]}
          height={MARK_PX[size]}
          className="size-full object-cover"
        />
      </span>
    );
  }
  return (
    <span
      data-role-monogram=""
      aria-hidden="true"
      className={cn(MARK_CLASS, MARK_BOX[size], className)}
    >
      {monogram}
    </span>
  );
}
