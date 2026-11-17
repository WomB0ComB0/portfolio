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
 * @file One role hung off the story's rail: its month at the rail (from a 40rem page), a node on
 * the rail, and the role itself. Server-safe (no directive, no hooks); every word, duty and link
 * is in the server HTML, and "What I did" is a native <details> that opens without JavaScript.
 *
 * - Weight is earned (role-story.ts): the lead's title is set at display size with its whole
 *   description and duties; a year's major role a step down with the same; a compact role shows
 *   its title, its opening sentences and its technologies, and keeps the rest behind "What I did".
 * - The meta line is a sentence-case byline: since when (or from and to), and how long in words.
 * - The title is the role's page link. A title's size is the smallest of a rem clamp and its own
 *   box's width over its widest word (--fit), so enlarged text never splits a word in it.
 * - The organization's logo, where Studio has one, sits small before its name, so every title
 *   on the rail starts at one edge; a role without a logo shows its name alone (no letter tile).
 * - Hover (a mouse) lifts the role 2px on the house spring and lights it: a surface wash with a
 *   faint brand rim, the node ringed in brand, the logo uncapped. Keyboard focus inside it gives
 *   the same light without the move; the stop a link landed on (:target) wears the brand rim.
 *   Reduced motion keeps the light and drops the move.
 * - A narrow column (a 20rem page or less: a 320px phone, or any phone with its text enlarged)
 *   narrows the rail's gutter and drops the duties' dash and indent, so the words get the
 *   width and no word has to break inside itself.
 */

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { CSSProperties, ReactElement } from 'react';
import { SrOnlyWords } from '@/components/console';
import { widestWordUnits } from '@/components/console/folio/word-measure';
import { cn } from '@/lib/utils';
import { roleRowAnchor } from '../../_lib/role-index';
import type { StoryStop, StoryWeight } from '../../_lib/role-story';
import { LOGO_AT_REST_CLASS, RoleMark } from '../role-parts';
import { RoleProgression } from '../role-progression';
import { LinkedProse } from './linked-prose';

export const MORE_LABEL = 'What I did';
export const TECH_LABEL = 'Built with';
export const SINCE_WORD = 'Since';

/** The dot between parts, glued to the part before it, so no wrapped line starts with one. */
const SEPARATOR = ' · ';

/**
 * A stop: the month, the rail's column and the role. On a phone the month gives way (the byline
 * says it) and the rail is the first 1.25rem, 0.75rem in a narrow column; from a 40rem page the
 * month takes 4.5rem before it. The rail's own line is drawn by the chapter's list
 * (role-chapter.tsx) at the same x.
 */
const STOP_CLASS = {
  base: [
    'group/stop relative grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3',
    '@max-[20rem]/page:grid-cols-[0.75rem_minmax(0,1fr)] @max-[20rem]/page:gap-x-2',
    '@min-[40rem]/page:grid-cols-[4.5rem_1.5rem_minmax(0,1fr)] @min-[40rem]/page:gap-x-4',
    // A link that lands here stops clear of the window's top edge; html's padding clears the haze.
    'scroll-mt-6',
  ].join(' '),
  lead: 'pb-[clamp(3rem,2.25rem+2.5vw,4.5rem)] last:pb-0',
  major: 'py-[clamp(1rem,0.75rem+1vw,1.75rem)] pb-[clamp(2.75rem,2rem+2vw,4rem)] last:pb-0',
  compact: 'pb-[clamp(2rem,1.5rem+1.5vw,2.75rem)] last:pb-0',
} as const;

/** The month at the rail, level with the byline's first line; only from a 40rem page. */
const MONTH_CLASS =
  'hidden pt-px text-right tile-meta whitespace-nowrap tabular-nums text-faint transition-colors duration-(--motion-base) ease-effect group-hover/stop:text-muted-foreground @min-[40rem]/page:block';

/** The node on the rail: a ring on the canvas, ringed in brand while its role is lit. */
const NODE_BASE =
  'relative z-[1] justify-self-center rounded-full border bg-canvas transition-[border-color,box-shadow,scale] duration-(--motion-spring-out) ease-spring';
const NODE_LIT =
  '[@media(hover:hover)]:group-hover/stop:scale-125 [@media(hover:hover)]:group-hover/stop:border-brand-ink [@media(hover:hover)]:group-hover/stop:shadow-[0_0_0_4px_var(--brand-glow)] [@media(hover:hover)]:group-hover/stop:duration-(--motion-spring-in) group-has-[:focus-visible]/stop:border-brand-ink group-has-[:focus-visible]/stop:shadow-[0_0_0_4px_var(--brand-glow)] group-target/stop:border-brand-ink motion-reduce:scale-100!';
const NODE_CLASS: Readonly<Record<StoryWeight, string>> = {
  lead: `${NODE_BASE} ${NODE_LIT} mt-[0.1875rem] size-3 border-brand shadow-[0_0_0_4px_var(--brand-glow)]`,
  major: `${NODE_BASE} ${NODE_LIT} mt-[0.25rem] size-2.5 border-brand-ink`,
  compact: `${NODE_BASE} ${NODE_LIT} mt-[0.3125rem] size-[0.5625rem] border-hairline-strong`,
};

/**
 * The role's words. Their light is the ::before, drawn behind them a little past their box; only
 * opacity changes. The lift is a transform on the house spring, so a quick pass reverses
 * mid-way. On a phone the light reaches half a rem past the words, inside the gutter.
 */
const ENTRY_CLASS = [
  'relative isolate block min-w-0 [grid-column:-2/-1]',
  'transition-transform duration-(--motion-spring-out) ease-spring',
  '[@media(hover:hover)]:group-hover/stop:-translate-y-0.5 [@media(hover:hover)]:group-hover/stop:duration-(--motion-spring-in) motion-reduce:translate-y-0!',
  "before:pointer-events-none before:absolute before:-inset-x-2 before:-inset-y-3 before:-z-10 before:rounded-tile before:content-['']",
  '@min-[40rem]/page:before:-inset-x-4 @min-[40rem]/page:before:-inset-y-4',
  'before:bg-surface-1 before:shadow-[inset_0_0_0_1px_var(--brand-edge),var(--shadow-tile)]',
  'before:opacity-0 before:transition-opacity before:duration-(--motion-base) before:ease-effect',
  '[@media(hover:hover)]:group-hover/stop:before:opacity-100 group-has-[:focus-visible]/stop:before:opacity-100',
  'group-target/stop:before:opacity-100 group-target/stop:before:shadow-[inset_0_0_0_1px_var(--brand-rim),var(--shadow-tile)]',
  'forced-colors:group-target/stop:outline-2 forced-colors:group-target/stop:outline-offset-8 forced-colors:group-target/stop:outline-[color:Highlight]',
].join(' ');
const ENTRY_WIDTH: Readonly<Record<StoryWeight, string>> = {
  lead: 'max-w-[54rem]',
  major: 'max-w-[50rem]',
  compact: 'max-w-[46rem]',
};

/**
 * The logo, small before the organization's name and centred on its line: in its own colours,
 * its highlights capped at rest (role-parts.tsx says why) so a white tile never glares; the cap
 * lifts while the role is lit. A role without a logo has none: a letter in a grey tile said
 * nothing the name beside it did not (the verifiers), and beside a display title it read as a
 * placeholder.
 */
const LOGO_CLASS = [
  'mr-2 align-middle',
  LOGO_AT_REST_CLASS,
  '[@media(hover:hover)]:group-hover/stop:before:opacity-0 group-has-[:focus-visible]/stop:before:opacity-0',
].join(' ');
const LOGO_SIZE: Readonly<Record<StoryWeight, string>> = {
  lead: '-mt-0.5 size-6 rounded-[0.4375rem]',
  major: '-mt-0.5 size-5',
  compact: '-mt-px size-[1.125rem] rounded-[0.3125rem]',
};

/** The words: a container, so the title's size follows their width. */
const BODY_CLASS = '@container/entry min-w-0';
const META_CLASS = 'tile-meta text-faint [overflow-wrap:break-word]';
const META_SEPARATOR_CLASS = 'text-hairline-strong';

/**
 * The words' width in em (--entry-w), stepped down from container queries on the words' box, so
 * the fit is in the same units as the size it sets: under the root at 200% the box is half as
 * many em and the title steps down with it. Each step takes its band's lower edge, so a title is
 * never set wider than its box, only up to a step smaller. Known limit (measured in Chrome,
 * 2026-11-15): a phone's text-size-adjust multiplies the final font size after every unit is
 * resolved, so no width fit sees it, and at 200% a long title word can still split there. The
 * folio numerals and the page's h1 share it.
 */
const ENTRY_WIDTH_STEPS = [
  '[--entry-w:4]',
  '@min-[5em]/entry:[--entry-w:5]',
  '@min-[6em]/entry:[--entry-w:6]',
  '@min-[7em]/entry:[--entry-w:7]',
  '@min-[8em]/entry:[--entry-w:8]',
  '@min-[9em]/entry:[--entry-w:9]',
  '@min-[10em]/entry:[--entry-w:10]',
  '@min-[11em]/entry:[--entry-w:11]',
  '@min-[12em]/entry:[--entry-w:12]',
  '@min-[13em]/entry:[--entry-w:13]',
  '@min-[15em]/entry:[--entry-w:15]',
  '@min-[17em]/entry:[--entry-w:17]',
  '@min-[20em]/entry:[--entry-w:20]',
  '@min-[24em]/entry:[--entry-w:24]',
  '@min-[30em]/entry:[--entry-w:30]',
].join(' ');

/**
 * Each title is the smallest of a rem clamp and the words' width over its widest word (--fit, in
 * average Geist 600 letters, word-measure.ts) at 0.66em a letter: the kit's 0.6em runs a hair
 * short for "Undergraduate" in this weight and tracking. So enlarged text shrinks a long word
 * rather than splitting it. (Each class is written out whole: Tailwind reads them from source.)
 */
const TITLE_CLASS: Readonly<Record<StoryWeight, string>> = {
  lead: `${ENTRY_WIDTH_STEPS} mt-2 text-[length:min(clamp(2.25rem,1.5rem+3.5cqi,3.5rem),calc(var(--entry-w)*1rem/(var(--fit)*0.66)))] leading-[1.04] font-semibold tracking-[-0.04em] text-balance`,
  major: `${ENTRY_WIDTH_STEPS} mt-1.5 text-[length:min(clamp(1.625rem,1.25rem+2cqi,2.25rem),calc(var(--entry-w)*1rem/(var(--fit)*0.66)))] leading-[1.1] font-semibold tracking-[-0.03em] text-balance`,
  compact: `${ENTRY_WIDTH_STEPS} mt-1 text-[length:min(1.25rem,calc(var(--entry-w)*1rem/(var(--fit)*0.66)))] leading-[1.3] font-semibold tracking-[-0.02em]`,
};
/**
 * The title's link, in the title's colour; it takes the brand ink while its role is lit. A tenth
 * of an em above and below, taken back by margin, holds the glyphs the display sizes' tight
 * lines would let stand out of the box; on a touch screen the same trick makes it 44px tall
 * (a compact title's 26px line and 9px each side).
 * Neither moves a pixel.
 */
const TITLE_LINK_CLASS =
  'block rounded-sm -my-[0.1em] py-[0.1em] text-foreground no-underline [overflow-wrap:anywhere] transition-colors duration-(--motion-base) ease-effect [@media(hover:hover)]:group-hover/stop:text-brand-ink focus-visible:text-brand-ink pointer-coarse:-my-[0.5625rem] pointer-coarse:py-[0.5625rem]';
const ORG_CLASS: Readonly<Record<StoryWeight, string>> = {
  lead: 'mt-2 text-[1.125rem] leading-[1.5rem] text-muted-foreground',
  major: 'mt-1.5 text-base leading-6 text-muted-foreground',
  compact: 'mt-0.5 tile-sub text-muted-foreground',
};
const ORG_NAME_CLASS = 'text-foreground/90';
const SENTENCE_CLASS: Readonly<Record<StoryWeight, string>> = {
  lead: 'mt-4 max-w-[62ch] text-[1.0625rem] leading-[1.7rem] text-pretty text-foreground @min-[36rem]/entry:text-[1.1875rem] @min-[36rem]/entry:leading-[1.85rem]',
  major: 'mt-3 max-w-[64ch] text-base leading-[1.65rem] text-pretty text-foreground/90',
  compact: 'mt-2.5 max-w-[64ch] text-[0.9375rem] leading-6 text-pretty text-muted-foreground',
};

const DUTIES_CLASS = 'mt-4 flex max-w-[64ch] flex-col gap-2.5';
/** A quiet dash before each duty; a narrow column drops it and its indent for the words. */
const DUTY_CLASS =
  "relative pl-4 text-[0.9375rem] leading-6 text-muted-foreground before:absolute before:top-[0.6875rem] before:left-0.5 before:h-px before:w-2 before:bg-hairline-strong before:content-[''] @max-[20rem]/page:pl-0 @max-[20rem]/page:before:hidden";

/**
 * The technologies: quiet words that run as a line of text, so each separator stays glued to
 * the word before it and a line breaks only at the space after a dot.
 */
const TECH_CLASS = 'mt-3 max-w-[64ch] tile-meta text-faint [&>li]:inline';

/** "What I did": a quiet line with a chevron that turns on the spring when it opens. */
const MORE_CLASS = 'group/more mt-2.5 max-w-[64ch]';
const MORE_SUMMARY_CLASS = [
  '-ml-1 inline-flex min-h-8 cursor-pointer list-none items-center gap-1.5 rounded-md px-1 tile-label text-muted-foreground',
  'transition-colors duration-(--motion-fast) ease-effect hover:text-foreground focus-visible:text-foreground group-open/more:text-foreground',
  '[&::-webkit-details-marker]:hidden pointer-coarse:min-h-11',
].join(' ');
const MORE_CHEVRON_CLASS =
  'size-3.5 flex-none transition-[rotate] duration-(--motion-spring-out) ease-spring group-open/more:rotate-90 group-open/more:duration-(--motion-spring-in)';
const MORE_BODY_CLASS =
  'pb-1 pl-5 @max-[20rem]/page:pl-0 details-content:opacity-0 details-content:transition-opacity details-content:duration-(--motion-base) open:details-content:opacity-100 motion-reduce:details-content:transition-none';
const MORE_TEXT_CLASS = 'mt-1 text-[0.9375rem] leading-6 text-pretty text-muted-foreground';

/** 'Apr 2024 – Feb 2026', the dash read as "to"; a one-month role is its month once. */
function PeriodWords({ stop }: { readonly stop: StoryStop }): ReactElement {
  const { start, end, text } = stop.row.period;
  if (!start || !end) return <>{text}</>;
  if (start.iso === end.iso) return <time dateTime={start.iso}>{start.label}</time>;
  return (
    <>
      <time dateTime={start.iso}>{start.label}</time>
      <span aria-hidden="true"> – </span>
      <span className="sr-only select-none"> to </span>
      <time dateTime={end.iso}>{end.label}</time>
    </>
  );
}

/** Since when (a current role) or from and to, then how long in words. */
function StopMeta({ stop }: { readonly stop: StoryStop }): ReactElement {
  const { length, current, employmentType } = stop.row;
  const start = stop.row.period.start;
  return (
    <p data-role-meta="" className={META_CLASS}>
      <span data-role-period="">
        {current && start ? (
          <>
            {SINCE_WORD} <time dateTime={start.iso}>{start.label}</time>
          </>
        ) : (
          <PeriodWords stop={stop} />
        )}
      </span>
      {length ? (
        <>
          <span aria-hidden="true" className={META_SEPARATOR_CLASS}>
            {SEPARATOR}
          </span>
          <span className="sr-only">, </span>
          <span data-role-length="">{length.spoken}</span>
        </>
      ) : null}
      {employmentType ? (
        <>
          <span aria-hidden="true" className={META_SEPARATOR_CLASS}>
            {SEPARATOR}
          </span>
          <span className="sr-only">, </span>
          <span>{employmentType}</span>
        </>
      ) : null}
    </p>
  );
}

/** The technologies, as quiet words; nothing for none. */
function StopTech({ stop }: { readonly stop: StoryStop }): ReactElement | null {
  const names = [...new Set(stop.row.tech.map((token) => token.name))];
  if (names.length === 0) return null;
  return (
    <ul data-role-tech="" aria-label={TECH_LABEL} className={TECH_CLASS}>
      {names.map((name, index) => (
        <li key={name}>
          {name}
          {index < names.length - 1 ? (
            <span aria-hidden="true" className={META_SEPARATOR_CLASS}>
              {SEPARATOR}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

interface StopDutiesProps {
  readonly duties: StoryStop['prose']['duties'];
  readonly className?: string;
}

/** The duties as a quiet list; nothing for none. */
function StopDuties({ duties, className }: StopDutiesProps): ReactElement | null {
  if (duties.length === 0) return null;
  return (
    <ul data-role-duties="" className={cn(DUTIES_CLASS, className)}>
      {duties.map((duty, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: Studio may list one duty twice.
        <li key={index} className={DUTY_CLASS}>
          <LinkedProse as="span" parts={duty} />
        </li>
      ))}
    </ul>
  );
}

/** A compact role's "What I did": the rest of its description and its duties, closed at first. */
function StopMore({ stop }: { readonly stop: StoryStop }): ReactElement | null {
  const { more, duties } = stop.prose;
  if (more.length === 0 && duties.length === 0) return null;
  return (
    <details data-role-more="" className={MORE_CLASS}>
      <summary className={MORE_SUMMARY_CLASS}>
        <ChevronRight aria-hidden="true" className={MORE_CHEVRON_CLASS} />
        {MORE_LABEL}
        <SrOnlyWords>{`as ${stop.row.role} at ${stop.row.organization}`}</SrOnlyWords>
      </summary>
      <div className={MORE_BODY_CLASS}>
        <LinkedProse parts={more} className={MORE_TEXT_CLASS} />
        <StopDuties duties={duties} className="mt-2" />
      </div>
    </details>
  );
}

/** The logo where there is one, the organization and, after a glued dot, where. */
function StopOrganization({ stop }: { readonly stop: StoryStop }): ReactElement {
  const { organization, location, logo } = stop.row;
  return (
    <p data-role-organization="" className={ORG_CLASS[stop.weight]}>
      {logo ? (
        <RoleMark
          logo={logo}
          monogram=""
          size={stop.weight === 'lead' ? 'md' : 'sm'}
          className={cn(LOGO_CLASS, LOGO_SIZE[stop.weight])}
        />
      ) : null}
      <span data-role-org-name="" className={ORG_NAME_CLASS}>
        {organization}
      </span>
      {location ? (
        <>
          <span aria-hidden="true" className={META_SEPARATOR_CLASS}>
            {SEPARATOR}
          </span>
          <span className="sr-only">, </span>
          <span data-role-location="">{location}</span>
        </>
      ) : null}
    </p>
  );
}

export interface RoleStopProps {
  readonly stop: StoryStop;
}

/** One role on the rail, at its weight. */
export function RoleStop({ stop }: RoleStopProps): ReactElement {
  const { row, weight, month, prose } = stop;
  const fit = { '--fit': String(Math.max(1, widestWordUnits(row.role))) } as CSSProperties;
  return (
    <li
      id={roleRowAnchor(row.id)}
      data-role-row=""
      data-id={row.id}
      data-weight={weight}
      data-current={row.current ? '' : undefined}
      data-light-role={row.id}
      className={cn(STOP_CLASS.base, STOP_CLASS[weight])}
    >
      <span aria-hidden="true" data-stop-month="" className={MONTH_CLASS}>
        {month}
      </span>
      <span aria-hidden="true" data-stop-node="" className={NODE_CLASS[weight]} />
      <article className={cn(ENTRY_CLASS, ENTRY_WIDTH[weight])}>
        <div className={BODY_CLASS}>
          <StopMeta stop={stop} />
          <h3 className={TITLE_CLASS[weight]} style={fit}>
            <Link href={row.href} prefetch={false} data-role-page="" className={TITLE_LINK_CLASS}>
              {row.role}
              <SrOnlyWords>{`at ${row.organization}`}</SrOnlyWords>
            </Link>
          </h3>
          <StopOrganization stop={stop} />
          <LinkedProse parts={prose.sentence} className={SENTENCE_CLASS[weight]} />
          <RoleProgression
            id={`role-${row.id}-progression`}
            subRoles={row.subRoles}
            variant="compact"
          />
          {weight === 'compact' ? null : <StopDuties duties={prose.duties} />}
          <StopTech stop={stop} />
          {weight === 'compact' ? <StopMore stop={stop} /> : null}
        </div>
      </article>
    </li>
  );
}
