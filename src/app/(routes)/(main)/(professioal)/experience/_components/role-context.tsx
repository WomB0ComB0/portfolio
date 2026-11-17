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
 * @file Where one role sits among the others, for /experience/[id]. Server-safe (no directive,
 * no hooks); every figure comes from the model (role-page.ts), which reads only the dates.
 *
 * - RoleClockTile: "this role on the clock". The list's stack with this role's months as its
 *   bottom row, in brand under a band, and every other role's month above it in the quiet tone:
 *   its lane among the others, to scale. Beside it, how many roles ran alongside and how many
 *   ran at once at its busiest. The drawing is decorative; a sentence says the same in words.
 * - RoleCompanions: the roles that ran alongside, the most months shared first, each a link.
 * - RoleSteps: the roles before and after it in the list's order, as two tiles that lift.
 */

import { ArrowLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactElement } from 'react';

import { SrOnlyWords, Tile } from '@/components/console';
import { LinkPending } from '@/components/data';
import { cn } from '@/lib/utils';
import { peakSpoken, peakText } from '../_lib/role-clock';
import type { RoleRow } from '../_lib/role-index';
import { roleCount } from '../_lib/role-ledger';
import type { RoleCompanion, RolePage } from '../_lib/role-page';
import { MonthStack, StackLegend } from './month-stack';
import { RolePeriodText } from './role-parts';
import { RoleLengthFigure } from './role-row-parts';

const CLOCK_LABEL = 'On the clock';
const COMPANIONS_LABEL = 'Ran alongside';
const STEPS_LABEL = 'Other roles';
const BESIDE_UNIT = 'alongside';
const BUSIEST_UNIT = 'at once at its busiest';
const COMPANIONS_ORDER = 'by months shared';
const SHARED_WORD = 'shared';
const NOW_LABEL = 'Now';
/** What the stack's two tones mean on a role's own page. */
const STACK_KEYS = [
  { tone: 'brand', label: 'this role' },
  { tone: 'quiet', label: 'the others' },
] as const;
const STEP_LABELS = { previous: 'Previous', next: 'Next' } as const;

/**
 * The tile: the two figures over the plot on a phone (one under the other on a narrow one,
 * where both would not fit a line); beside the plot from 40rem; and from 64rem one to each
 * side of it. The plot takes what is left: a month's cell is 9px tall at least, 16px at most.
 */
const CLOCK_CLASS = [
  'grid gap-x-8 p-4 @min-[40rem]/page:p-5',
  "grid-cols-1 [grid-template-areas:'label'_'beside'_'busiest'_'plot']",
  "@min-[24rem]/page:grid-cols-[minmax(0,1fr)_auto] @min-[24rem]/page:[grid-template-areas:'label_label'_'beside_busiest'_'plot_plot']",
  '@min-[40rem]/page:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] @min-[40rem]/page:grid-rows-[auto_auto_1fr]',
  "@min-[40rem]/page:[grid-template-areas:'label_plot'_'beside_plot'_'busiest_plot']",
  '@min-[64rem]/page:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_minmax(0,12rem)] @min-[64rem]/page:grid-rows-[auto_1fr]',
  "@min-[64rem]/page:[grid-template-areas:'label_plot_busiest'_'beside_plot_busiest']",
].join(' ');
const CLOCK_LABEL_CLASS = 'tile-label text-muted-foreground [grid-area:label]';
const BESIDE_CLASS = 'figure-row mt-3 [grid-area:beside]';
/**
 * Under "alongside" on a narrow phone; at the right of it on a wider one; from 40rem at the foot
 * of its zone, by the plot's last line.
 */
const BUSIEST_CLASS = [
  'mt-2 flex flex-col gap-0.5 self-end [grid-area:busiest]',
  '@min-[24rem]/page:mt-3 @min-[24rem]/page:items-end @min-[24rem]/page:text-right',
  '@min-[40rem]/page:items-start @min-[40rem]/page:text-left',
].join(' ');
/** A container, so the line under the stack answers to the plot's own width. */
const PLOT_CLASS = '@container min-w-0 self-end [grid-area:plot]';

/**
 * The tile in words, for a screen reader: the clock's months, when this role ran, how many ran
 * alongside it and the most at once with its months spoken ("from Mar 2026 to Sep 2026", never
 * a dash). '' for a clock with no months or a role with no start.
 */
function contextCaption(page: RolePage): string {
  const first = page.clock.months[0];
  const last = page.clock.months.at(-1);
  const { start, end } = page.role.period;
  if (!first || !last || !start) return '';
  const ran = end ? `ran from ${start.label} to ${end.label}` : `has run since ${start.label}`;
  const others = page.alongside.length;
  const beside = `${others} other ${others === 1 ? 'role' : 'roles'} ran alongside it`;
  const most =
    page.busiest && page.busiest.count > 1
      ? `, and at most ${page.busiest.count} ran at once, ${peakSpoken(page.busiest)}`
      : '';
  return `Every role month by month from ${first.label} to ${last.label}: this one ${ran}, ${beside}${most}.`;
}

export interface RoleClockTileProps {
  readonly page: RolePage;
  readonly className?: string;
}

/** This role on the clock; nothing when the clock has no months. */
export function RoleClockTile({ page, className }: RoleClockTileProps): ReactElement | null {
  const first = page.clock.months[0];
  if (!first) return null;
  // One role at once is no finding: the figure is for a role something ran beside.
  const busiest = page.busiest && page.busiest.count > 1 ? page.busiest : null;
  return (
    <Tile
      as="section"
      padding="none"
      aria-labelledby="role-clock-title"
      data-role-on-clock=""
      className={cn(CLOCK_CLASS, className)}
    >
      <h2 id="role-clock-title" className={CLOCK_LABEL_CLASS}>
        {CLOCK_LABEL}
      </h2>
      <p data-role-beside="" className={BESIDE_CLASS}>
        <span className="figure-md text-foreground">{page.alongside.length}</span>{' '}
        <span className="figure-unit text-muted-foreground">
          {page.alongside.length === 1 ? 'role' : 'roles'} {BESIDE_UNIT}
        </span>
      </p>
      {busiest && (
        <p data-role-busiest="" className={BUSIEST_CLASS}>
          <span className="figure-row @min-[24rem]/page:justify-end @min-[40rem]/page:justify-start">
            <span className="figure-sm text-foreground">{busiest.count}</span>{' '}
            <span className="figure-unit text-muted-foreground">{BUSIEST_UNIT}</span>
          </span>{' '}
          <span className="tile-meta text-faint">{peakText(busiest)}</span>
        </p>
      )}
      <div data-role-plot="" className={PLOT_CLASS}>
        <p className="sr-only">{contextCaption(page)}</p>
        <MonthStack
          clock={page.clock}
          axis={page.axis}
          focus={page.role.id}
          mark={busiest}
          className="mt-8"
        />
        <StackLegend start={first.label} keys={STACK_KEYS} now={NOW_LABEL} />
      </div>
    </Tile>
  );
}

const SECTION_CLASS = 'flex min-w-0 flex-col';
const SECTION_HEAD_CLASS =
  'flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 border-b border-hairline-strong pb-2';
const SECTION_TITLE_CLASS = 'tile-title text-foreground';
const SECTION_NOTE_CLASS = 'tile-meta text-faint';
/** One column; two from a 40rem page and three from 64rem, a gutter between them. */
const COMPANIONS_CLASS =
  'grid grid-cols-1 gap-x-8 @min-[40rem]/page:grid-cols-2 @min-[64rem]/page:grid-cols-3';
/** Each role sits over a hairline; the link inside keeps its own rounded tint and focus ring. */
const COMPANION_ITEM_CLASS = 'min-w-0 border-b border-hairline py-px';
/**
 * A role that ran alongside: one link, tinted on hover, its organization turning brand ink.
 * The months shared sit at the right of the organization. Under an 18rem page (a phone with
 * its text enlarged) they go under the title, as the list's dates go under a row's length: at
 * the right they took half the line, and the organization split mid-word.
 */
const COMPANION_CLASS = [
  'group/companion relative grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 rounded-lg px-2 py-2.5 no-underline',
  '-outline-offset-2 transition-[background-color] duration-(--motion-base) ease-effect hover:bg-surface-1 hover:duration-(--motion-instant)',
  "[grid-template-areas:'org_shared'_'title_title']",
  "@max-[18rem]/page:grid-cols-1 @max-[18rem]/page:[grid-template-areas:'org'_'title'_'shared']",
].join(' ');
const COMPANION_ORG_CLASS =
  'min-w-0 tile-sub font-medium text-foreground transition-colors duration-(--motion-base) ease-effect [overflow-wrap:anywhere] [grid-area:org] group-hover/companion:text-brand-ink group-hover/companion:duration-(--motion-instant)';
const COMPANION_TITLE_CLASS =
  'min-w-0 tile-meta text-faint [overflow-wrap:anywhere] [grid-area:title]';
const COMPANION_SHARED_CLASS = 'tile-meta [grid-area:shared]';
/** Out of the text's flow, so a hidden spinner never moves the months shared. */
const COMPANION_PENDING_CLASS = 'absolute right-2 bottom-2.5 text-brand-ink';

export interface RoleCompanionsProps {
  readonly companions: readonly RoleCompanion[];
  readonly className?: string;
}

/** The roles that ran alongside, each a link to its page; nothing when none did. */
export function RoleCompanions({
  companions,
  className,
}: RoleCompanionsProps): ReactElement | null {
  if (companions.length === 0) return null;
  return (
    <section aria-labelledby="role-companions" className={cn(SECTION_CLASS, className)}>
      <div className={SECTION_HEAD_CLASS}>
        <h2 id="role-companions" className={SECTION_TITLE_CLASS}>
          {COMPANIONS_LABEL}
        </h2>
        <p data-role-companions-note="" className={SECTION_NOTE_CLASS}>
          {roleCount(companions.length)}, {COMPANIONS_ORDER}
        </p>
      </div>
      <ul className={COMPANIONS_CLASS}>
        {companions.map(({ role, shared }) => (
          <li key={role.id} className={COMPANION_ITEM_CLASS}>
            <Link
              href={role.href}
              prefetch={false}
              data-role-companion=""
              className={COMPANION_CLASS}
            >
              <span data-part="organization" className={COMPANION_ORG_CLASS}>
                {role.organization}
              </span>{' '}
              <span data-part="title" className={COMPANION_TITLE_CLASS}>
                {role.role}
              </span>{' '}
              <span className={COMPANION_SHARED_CLASS}>
                <RoleLengthFigure length={shared} />
                <SrOnlyWords>{SHARED_WORD}</SrOnlyWords>
              </span>
              <LinkPending className={COMPANION_PENDING_CLASS} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

type StepKind = keyof typeof STEP_LABELS;

/** Two tiles side by side from a 40rem page; "Next" keeps the right half when it is alone. */
const STEPS_CLASS = 'grid gap-4 @min-[40rem]/page:grid-cols-2';
const STEP_NEXT_CLASS =
  '@min-[40rem]/page:col-start-2 @min-[40rem]/page:items-end @min-[40rem]/page:text-right';
const STEP_LABEL_CLASS = 'inline-flex items-center gap-1.5 tile-label text-muted-foreground';
/** The arrow slides 3px on the spring with its tile's hover: back for "Previous", on for "Next". */
const STEP_ARROW_BASE_CLASS =
  'size-3.5 flex-none transition-[translate] duration-(--motion-spring-out) ease-spring group-hover/tile:duration-(--motion-spring-in) motion-reduce:group-hover/tile:translate-x-0';
const STEP_ARROW_CLASS = {
  previous: `${STEP_ARROW_BASE_CLASS} group-hover/tile:-translate-x-0.75`,
  next: `${STEP_ARROW_BASE_CLASS} group-hover/tile:translate-x-0.75`,
} as const;
/**
 * Under an 18rem page (a phone with its text enlarged) the name gives way by the tile's own
 * width, never below 0.875rem (still over the dates' 0.8125rem): at 1.25rem one-word names
 * ("TalentSprint", "Farmingdale") were wider than the tile and split mid-word. It breaks
 * anywhere only as a last resort.
 */
const STEP_ORG_CLASS =
  'mt-2 tile-title-lg text-foreground [overflow-wrap:anywhere] @max-[18rem]/page:text-[clamp(0.875rem,13cqi,1.25rem)] @max-[18rem]/page:leading-[1.3]';
const STEP_META_CLASS = 'mt-0.5 tile-meta text-faint [overflow-wrap:anywhere]';
/** The dates, on one line; under an 18rem page (enlarged text) they may wrap, not leave the tile. */
const STEP_PERIOD_CLASS = 'whitespace-nowrap @max-[18rem]/page:whitespace-normal';

/** One step: the whole tile is the link to that role's page. */
function RoleStep({
  kind,
  role,
}: {
  readonly kind: StepKind;
  readonly role: RoleRow;
}): ReactElement {
  return (
    <Tile
      variant="interactive"
      href={role.href}
      data-role-step={kind}
      className={cn(kind === 'next' && STEP_NEXT_CLASS)}
    >
      <span className={STEP_LABEL_CLASS}>
        {kind === 'previous' && (
          <ArrowLeft aria-hidden="true" className={STEP_ARROW_CLASS.previous} />
        )}
        {STEP_LABELS[kind]}
        {kind === 'next' && <ArrowRight aria-hidden="true" className={STEP_ARROW_CLASS.next} />}
      </span>{' '}
      <span className={STEP_ORG_CLASS}>{role.organization}</span>{' '}
      <span className={STEP_META_CLASS}>
        {role.role}
        {/* The dot stays with the title before it, so no line starts with one. */}
        <span aria-hidden="true">{'\u00a0· '}</span>
        <span className="sr-only select-none">, </span>
        <span className={STEP_PERIOD_CLASS}>
          <RolePeriodText period={role.period} />
        </span>
      </span>
    </Tile>
  );
}

export interface RoleStepsProps {
  readonly previous: RoleRow | null;
  readonly next: RoleRow | null;
  readonly className?: string;
}

/** The roles before and after this one in the list's order; nothing when it is the only role. */
export function RoleSteps({ previous, next, className }: RoleStepsProps): ReactElement | null {
  if (!previous && !next) return null;
  return (
    <nav aria-label={STEPS_LABEL} data-role-steps="" className={cn(STEPS_CLASS, className)}>
      {previous && <RoleStep kind="previous" role={previous} />}
      {next && <RoleStep kind="next" role={next} />}
    </nav>
  );
}
