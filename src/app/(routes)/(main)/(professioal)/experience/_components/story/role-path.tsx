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
 * @file "The path so far", the Story mock's map of every role on one month axis, set after the
 * Now chapter (never first on the page). Server-safe (no directive, no hooks): every role is a
 * real link to its stop on the rail, named by its organization, role and months, so the figure
 * reads and works without JavaScript. Palette tokens only: brand for a role that still runs,
 * the quiet surface and hairline for one that ended, the ongoing dot beside "Now".
 *
 * One list, two forms, by the figure's own width in rem (role-path.ts packs the lanes):
 * - wide (52rem and up, with a mouse): capsules share lanes, each name inside its capsule or
 *   just beside it;
 * - narrow (a tablet, a phone, a touch screen of any width, enlarged text): one row a role, its
 *   name hung over its line where the line starts, so nothing scrolls sideways and every row is
 *   a 44px target (a 24px capsule is too small a target for a finger).
 *
 * A mouse on a capsule lifts it 1px on the house spring and rims it in brand; keyboard focus
 * gives the same light with the house ring. The cross-lighting island (role-crosslight.tsx) also
 * lights a role's capsule while its stop on the rail is pointed at, and dims the others; it does
 * nothing on touch or under reduced motion, where the lift is dropped too.
 */

import type { ReactElement } from 'react';

import { cn } from '@/lib/utils';
import { type ClockAxis, type ClockPeak, peakSpoken, peakText } from '../../_lib/role-clock';
import type { PathRole, RolePath } from '../../_lib/role-path';
import { numberWord } from '../../_lib/role-story';
import { type CssVars, percentOf, YEAR_LINES_CLASS } from '../role-lane';

export const PATH_TITLE = 'The path so far';
export const PATH_NOW = 'Now';

/**
 * The figure is the container both forms answer to: the wide one from 52rem (PATH_PACKED_REM)
 * with a fine pointer. Every class below is written out whole, as Tailwind reads the source.
 */
const FIGURE_CLASS = '@container/path min-w-0 mt-[clamp(3rem,2rem+3vw,4.5rem)]';
const CAPTION_CLASS = 'max-w-[62ch] text-[0.9375rem] leading-6 text-muted-foreground text-pretty';
const CAPTION_TITLE_CLASS = 'font-medium text-foreground';

/** "Now" over the axis's end, its ongoing dot beside the word (the only status colour). */
const NOW_CLASS =
  'mt-5 flex items-center justify-end gap-1.5 tile-meta text-muted-foreground forced-colors:text-[CanvasText]';
const NOW_DOT_CLASS =
  'size-1.5 rounded-full bg-ongoing forced-colors:[forced-color-adjust:none] forced-colors:bg-[CanvasText]';

/** The plot: the year lines, and the dashed edge at this month. */
const LANES_CLASS = [
  'relative mt-2 flex flex-col border-r border-dashed border-hairline-strong',
  YEAR_LINES_CLASS,
  'pointer-fine:@min-[52rem]/path:block pointer-fine:@min-[52rem]/path:h-[calc(var(--lanes)*1.875rem-0.375rem)]',
].join(' ');

/**
 * A role: a row on a narrow figure; a capsule on its lane on a wide one. Each is a container, so
 * a name set beside its capsule can move inside once the capsule is wide enough for it.
 */
const ROLE_CLASS =
  '@container/cap relative pointer-fine:@min-[52rem]/path:absolute pointer-fine:@min-[52rem]/path:top-[calc(var(--lane)*1.875rem)] pointer-fine:@min-[52rem]/path:left-(--l) pointer-fine:@min-[52rem]/path:h-6 pointer-fine:@min-[52rem]/path:w-(--w)';

/**
 * The link: the whole row (name and line), 44px tall, with a surface wash on hover or focus; on
 * a wide figure the capsule's box, lifted on the spring. data-lit is the island's light.
 */
const LINK_CLASS = [
  'group/cap relative isolate block rounded-md py-1.5 text-muted-foreground no-underline',
  "before:absolute before:-inset-x-2 before:inset-y-0 before:-z-10 before:rounded-md before:bg-surface-1 before:opacity-0 before:content-['']",
  'before:transition-opacity before:duration-(--motion-base) before:ease-effect',
  '[@media(hover:hover)]:hover:before:opacity-100 focus-visible:before:opacity-100 data-[lit=on]:before:opacity-100',
  'transition-[translate,opacity] duration-(--motion-spring-out) ease-spring data-[lit=off]:opacity-45',
  'pointer-fine:@min-[52rem]/path:absolute pointer-fine:@min-[52rem]/path:inset-0 pointer-fine:@min-[52rem]/path:flex pointer-fine:@min-[52rem]/path:items-center pointer-fine:@min-[52rem]/path:rounded-full pointer-fine:@min-[52rem]/path:py-0 pointer-fine:@min-[52rem]/path:before:hidden',
  'pointer-fine:@min-[52rem]/path:[@media(hover:hover)]:hover:-translate-y-px pointer-fine:@min-[52rem]/path:[@media(hover:hover)]:hover:duration-(--motion-spring-in) pointer-fine:@min-[52rem]/path:data-[lit=on]:-translate-y-px',
  'motion-reduce:translate-y-0!',
].join(' ');

/** The name: hung over its line where the line starts, or inside or beside its capsule. */
const LABEL_BASE =
  'relative z-[1] block pl-[clamp(0%,var(--l),calc(100%-var(--label-w)))] tile-sub text-foreground/85 transition-colors duration-(--motion-fast) ease-effect group-hover/cap:text-foreground group-focus-visible/cap:text-foreground pointer-fine:@min-[52rem]/path:text-xs pointer-fine:@min-[52rem]/path:leading-4 pointer-fine:@min-[52rem]/path:font-medium pointer-fine:@min-[52rem]/path:whitespace-nowrap';
const LABEL_SIDE: Readonly<Record<PathRole['label'], string>> = {
  inside: 'pointer-fine:@min-[52rem]/path:px-2.5',
  after:
    'pointer-fine:@min-[52rem]/path:absolute pointer-fine:@min-[52rem]/path:left-full pointer-fine:@min-[52rem]/path:ml-1.5 pointer-fine:@min-[52rem]/path:pl-0',
  before:
    'pointer-fine:@min-[52rem]/path:absolute pointer-fine:@min-[52rem]/path:right-full pointer-fine:@min-[52rem]/path:mr-1.5 pointer-fine:@min-[52rem]/path:pl-0',
};

/**
 * A name set beside its capsule moves inside it once the capsule is as wide as the name needs
 * (PathRole.insideRem, rounded up to a step). The lane keeps the room beside it either way, so
 * nothing else moves. Each class is written out whole: Tailwind reads them from the source.
 */
const INSIDE_FROM: readonly (readonly [number, string])[] = [
  [
    4,
    'pointer-fine:@min-[52rem]/path:@min-[4rem]/cap:relative pointer-fine:@min-[52rem]/path:@min-[4rem]/cap:inset-x-auto pointer-fine:@min-[52rem]/path:@min-[4rem]/cap:mx-0 pointer-fine:@min-[52rem]/path:@min-[4rem]/cap:px-2.5',
  ],
  [
    5,
    'pointer-fine:@min-[52rem]/path:@min-[5rem]/cap:relative pointer-fine:@min-[52rem]/path:@min-[5rem]/cap:inset-x-auto pointer-fine:@min-[52rem]/path:@min-[5rem]/cap:mx-0 pointer-fine:@min-[52rem]/path:@min-[5rem]/cap:px-2.5',
  ],
  [
    6,
    'pointer-fine:@min-[52rem]/path:@min-[6rem]/cap:relative pointer-fine:@min-[52rem]/path:@min-[6rem]/cap:inset-x-auto pointer-fine:@min-[52rem]/path:@min-[6rem]/cap:mx-0 pointer-fine:@min-[52rem]/path:@min-[6rem]/cap:px-2.5',
  ],
  [
    7,
    'pointer-fine:@min-[52rem]/path:@min-[7rem]/cap:relative pointer-fine:@min-[52rem]/path:@min-[7rem]/cap:inset-x-auto pointer-fine:@min-[52rem]/path:@min-[7rem]/cap:mx-0 pointer-fine:@min-[52rem]/path:@min-[7rem]/cap:px-2.5',
  ],
  [
    8,
    'pointer-fine:@min-[52rem]/path:@min-[8rem]/cap:relative pointer-fine:@min-[52rem]/path:@min-[8rem]/cap:inset-x-auto pointer-fine:@min-[52rem]/path:@min-[8rem]/cap:mx-0 pointer-fine:@min-[52rem]/path:@min-[8rem]/cap:px-2.5',
  ],
  [
    9,
    'pointer-fine:@min-[52rem]/path:@min-[9rem]/cap:relative pointer-fine:@min-[52rem]/path:@min-[9rem]/cap:inset-x-auto pointer-fine:@min-[52rem]/path:@min-[9rem]/cap:mx-0 pointer-fine:@min-[52rem]/path:@min-[9rem]/cap:px-2.5',
  ],
  [
    10,
    'pointer-fine:@min-[52rem]/path:@min-[10rem]/cap:relative pointer-fine:@min-[52rem]/path:@min-[10rem]/cap:inset-x-auto pointer-fine:@min-[52rem]/path:@min-[10rem]/cap:mx-0 pointer-fine:@min-[52rem]/path:@min-[10rem]/cap:px-2.5',
  ],
  [
    12,
    'pointer-fine:@min-[52rem]/path:@min-[12rem]/cap:relative pointer-fine:@min-[52rem]/path:@min-[12rem]/cap:inset-x-auto pointer-fine:@min-[52rem]/path:@min-[12rem]/cap:mx-0 pointer-fine:@min-[52rem]/path:@min-[12rem]/cap:px-2.5',
  ],
  [
    14,
    'pointer-fine:@min-[52rem]/path:@min-[14rem]/cap:relative pointer-fine:@min-[52rem]/path:@min-[14rem]/cap:inset-x-auto pointer-fine:@min-[52rem]/path:@min-[14rem]/cap:mx-0 pointer-fine:@min-[52rem]/path:@min-[14rem]/cap:px-2.5',
  ],
  [
    16,
    'pointer-fine:@min-[52rem]/path:@min-[16rem]/cap:relative pointer-fine:@min-[52rem]/path:@min-[16rem]/cap:inset-x-auto pointer-fine:@min-[52rem]/path:@min-[16rem]/cap:mx-0 pointer-fine:@min-[52rem]/path:@min-[16rem]/cap:px-2.5',
  ],
  [
    18,
    'pointer-fine:@min-[52rem]/path:@min-[18rem]/cap:relative pointer-fine:@min-[52rem]/path:@min-[18rem]/cap:inset-x-auto pointer-fine:@min-[52rem]/path:@min-[18rem]/cap:mx-0 pointer-fine:@min-[52rem]/path:@min-[18rem]/cap:px-2.5',
  ],
  [
    20,
    'pointer-fine:@min-[52rem]/path:@min-[20rem]/cap:relative pointer-fine:@min-[52rem]/path:@min-[20rem]/cap:inset-x-auto pointer-fine:@min-[52rem]/path:@min-[20rem]/cap:mx-0 pointer-fine:@min-[52rem]/path:@min-[20rem]/cap:px-2.5',
  ],
];

/** The class that moves a name beside its capsule inside it from its width; '' when none can. */
export function insideFromClass(role: Pick<PathRole, 'label' | 'insideRem'>): string {
  if (role.label === 'inside') return '';
  return INSIDE_FROM.find(([rem]) => rem >= role.insideRem)?.[1] ?? '';
}

/**
 * The line: thin under its name on a narrow figure (it follows the name, so it sits below it),
 * the capsule itself, behind the name, on a wide one. Brand while
 * the role runs, reaching the dashed edge square; the quiet tone, and a hairline rim, once ended.
 */
const LINE_BASE = [
  'mt-1.5 block h-1.5 rounded-full ml-(--l) w-(--w) transition-shadow duration-(--motion-base) ease-effect',
  'pointer-fine:@min-[52rem]/path:absolute pointer-fine:@min-[52rem]/path:inset-0 pointer-fine:@min-[52rem]/path:m-0 pointer-fine:@min-[52rem]/path:h-auto pointer-fine:@min-[52rem]/path:w-auto',
  'pointer-fine:@min-[52rem]/path:[@media(hover:hover)]:group-hover/cap:shadow-[inset_0_0_0_1px_var(--brand-rim),0_10px_24px_-10px_var(--brand-halo)]',
  'pointer-fine:@min-[52rem]/path:group-focus-visible/cap:shadow-[inset_0_0_0_1px_var(--brand-rim)] pointer-fine:@min-[52rem]/path:group-data-[lit=on]/cap:shadow-[inset_0_0_0_1px_var(--brand-rim),0_10px_24px_-10px_var(--brand-halo)]',
  'forced-colors:[forced-color-adjust:none]',
].join(' ');
/**
 * The tones. In forced colours a thin line is a system colour (Highlight running, GrayText
 * ended); a capsule, which carries its name, is the canvas with a rim in that colour, so the name
 * keeps the theme's own contrast.
 */
const LINE_TONE = {
  current: [
    'rounded-r-none bg-brand forced-colors:bg-[Highlight]',
    'pointer-fine:@min-[52rem]/path:bg-linear-to-r pointer-fine:@min-[52rem]/path:from-brand-subtle pointer-fine:@min-[52rem]/path:to-brand-subtle/70 pointer-fine:@min-[52rem]/path:shadow-[inset_0_0_0_1px_var(--brand-edge)]',
    'pointer-fine:@min-[52rem]/path:forced-colors:bg-none! pointer-fine:@min-[52rem]/path:forced-colors:bg-[Canvas]! pointer-fine:@min-[52rem]/path:forced-colors:shadow-[inset_0_0_0_2px_Highlight]!',
  ].join(' '),
  ended: [
    'bg-faint/70 forced-colors:bg-[GrayText]',
    'pointer-fine:@min-[52rem]/path:bg-surface-2 pointer-fine:@min-[52rem]/path:shadow-[inset_0_0_0_1px_var(--hairline-strong)]',
    'pointer-fine:@min-[52rem]/path:forced-colors:bg-[Canvas]! pointer-fine:@min-[52rem]/path:forced-colors:shadow-[inset_0_0_0_1px_GrayText]!',
  ].join(' '),
} as const;

const YEARS_CLASS = 'relative mt-2 block h-4';
const YEAR_CLASS =
  'absolute top-0 left-[calc(var(--at)+0.375rem)] tile-meta tabular-nums text-faint';
/** A year a very narrow plot has no room for (clockAxis decides which). */
const YEAR_SPARE_CLASS = '@max-[14.5rem]/path:hidden';

interface PathCapsuleProps {
  readonly role: PathRole;
  readonly columns: number;
}

/** One role: its name and line, a link to its stop, named in full for a screen reader. */
function PathCapsule({ role, columns }: PathCapsuleProps): ReactElement {
  const style: CssVars = {
    '--l': percentOf(role.start, columns),
    '--w': percentOf(role.end - role.start, columns),
    '--lane': role.lane,
    '--label-w': `${role.labelEm}em`,
  };
  const tone = LINE_TONE[role.current ? 'current' : 'ended'];
  return (
    <li
      data-path-role={role.label}
      data-span={role.end - role.start}
      data-current={role.current ? '' : undefined}
      className={ROLE_CLASS}
      style={style}
    >
      <a href={role.href} data-light-role={role.id} data-r={role.id} className={LINK_CLASS}>
        <span
          data-path-label=""
          className={cn(LABEL_BASE, LABEL_SIDE[role.label], insideFromClass(role))}
        >
          {role.organization}
        </span>
        <span className="sr-only">{`, ${role.role}, ${role.spoken}`}</span>
        <span aria-hidden="true" data-path-line="" className={cn(LINE_BASE, tone)} />
      </a>
    </li>
  );
}

/** The years under the plot, each just right of its line. Decorative. */
function PathYears({ axis }: { readonly axis: ClockAxis }): ReactElement {
  const columns = axis.columns.length;
  return (
    <span aria-hidden="true" data-path-years="" className={YEARS_CLASS}>
      {axis.ticks
        .filter((tick) => tick.labelled)
        .map((tick) => (
          <span
            key={tick.year}
            className={cn(YEAR_CLASS, !tick.narrow && YEAR_SPARE_CLASS)}
            style={{ '--at': percentOf(tick.column, columns) } as CssVars}
          >
            {tick.year}
          </span>
        ))}
    </span>
  );
}

const capitalised = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** The caption: what the lines are, and when the most ran at once (said only here). */
function PathCaption({ peak }: { readonly peak: ClockPeak | null }): ReactElement {
  return (
    <figcaption className={CAPTION_CLASS}>
      <span className={CAPTION_TITLE_CLASS}>{PATH_TITLE}.</span> Each line is a role, from its first
      month to its last; the lines that reach {PATH_NOW} are still going.
      {peak && peak.count > 1 ? (
        <>
          {' '}
          {capitalised(numberWord(peak.count))} ran at once at the peak,{' '}
          <span aria-hidden="true">{peakText(peak)}</span>
          <span className="sr-only">{peakSpoken(peak)}</span>.
        </>
      ) : null}
    </figcaption>
  );
}

export interface RolePathFigureProps {
  readonly path: RolePath;
  readonly axis: ClockAxis;
  readonly peak: ClockPeak | null;
  readonly className?: string;
}

/** The figure; nothing with fewer than two roles on the axis. */
export function RolePathFigure({
  path,
  axis,
  peak,
  className,
}: RolePathFigureProps): ReactElement | null {
  if (path.roles.length < 2) return null;
  return (
    <figure data-role-path="" className={cn(FIGURE_CLASS, className)}>
      <PathCaption peak={peak} />
      <p aria-hidden="true" data-path-now="" className={NOW_CLASS}>
        <span className={NOW_DOT_CLASS} />
        {PATH_NOW}
      </p>
      <ol data-path-lanes="" className={LANES_CLASS} style={{ '--lanes': path.lanes } as CssVars}>
        {path.roles.map((role) => (
          <PathCapsule key={role.id} role={role} columns={path.columns} />
        ))}
      </ol>
      <PathYears axis={axis} />
    </figure>
  );
}
