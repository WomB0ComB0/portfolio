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
 * @file The Live Console stat tile: one figure with its label and a line of context, in every
 * state a data source can be in. Server-safe (no directive; useId works in server components).
 *
 * Three rows that keep their places across states, so a tile does not jump when its data lands:
 * 1. the label, and a live badge while the figure updates live;
 * 2. the figure (or its placeholder, idle text or error dash), then any children (a sparkline);
 * 3. one line of context: meta or freshness and a delta, the stale note, or the error and action.
 *
 * Never a made-up number: no value means idle text, never 0, and an em dash appears only in the
 * error state, next to words.
 */

import { CircleAlert, Clock } from 'lucide-react';
import { type ReactElement, type ReactNode, useId } from 'react';

import type { Timestamp } from '@/components/console/format-age';
import { Freshness } from '@/components/console/freshness';
import { LiveNumber } from '@/components/console/live-number';
import { formatStatValue, presentValue } from '@/components/console/stat-strip';
import { StatusDot } from '@/components/console/status-dot';
import {
  type InteractiveTileProps,
  plainTileProps,
  type StaticTileProps,
  Tile,
} from '@/components/console/tile';
import { hasDestination } from '@/components/console/tile-link';
import { cn } from '@/lib/utils';

/** `ready` and `stale` show the value; `idle` means there is nothing to show right now. */
export type StatTileState = 'ready' | 'loading' | 'idle' | 'error' | 'stale';
export type StatTileSize = 'md' | 'lg' | 'xl';
export type StatTileLabelElement = 'p' | 'h2' | 'h3';

/** A change to show beside the figure, e.g. +12 this week. */
export interface StatDelta {
  value: number;
  /** Words after the amount, e.g. 'this week'. */
  period?: string;
  /** For figures where lower is better (latency): a fall is shown as the improvement. */
  invert?: boolean;
}

interface StatTileContentProps {
  /** The tile's name; it also names the tile for assistive tech. */
  label: ReactNode;
  /** null, undefined, '' or a non-finite number count as no value: the tile shows idleText. */
  value?: number | string | null;
  /** Shown after the value in smaller type, e.g. 'hours'. */
  unit?: string;
  /** Intl options for a number value and the delta; the locale is always en-US. */
  format?: Intl.NumberFormatOptions;
  /** Defaults to 'ready' with a value and 'idle' without one. */
  state?: StatTileState;
  /** When the figure was read. Shown as "updated 5 min ago" unless `meta` is given. */
  updatedAt?: Timestamp;
  /** The context line, in place of the freshness. */
  meta?: ReactNode;
  delta?: StatDelta;
  /** Shown in the idle state. */
  idleText?: string;
  /** Shown in the error state. */
  errorText?: string;
  /** Marks a figure that updates live: a pulsing dot and the word 'Live', while ready. */
  live?: boolean;
  /** Glides a number to each new value (LiveNumber). Use it in client islands that refetch. */
  tween?: boolean;
  size?: StatTileSize;
  /** The label's element. Use a heading when the tile is a section of the page. */
  labelAs?: StatTileLabelElement;
  /** The label's id, which the tile root points at with aria-labelledby. Generated if left out. */
  id?: string;
  /** Rendered under the figure, e.g. a sparkline or a bar. */
  children?: ReactNode;
}

type StatTileSlot = keyof StatTileContentProps | 'action';

/** A plain, raised or linked stat tile. Its root defaults to <article>. */
export type StaticStatTileProps = StatTileContentProps & {
  /** Shown beside the error text, e.g. a retry button or a link to the source. */
  action?: ReactNode;
} & Omit<StaticTileProps, StatTileSlot>;

/** A stat tile that is one link. It may hold no other control, so it takes no `action`. */
export type InteractiveStatTileProps = StatTileContentProps & {
  action?: never;
} & Omit<InteractiveTileProps, StatTileSlot>;

export type StatTileProps = StaticStatTileProps | InteractiveStatTileProps;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export type StatTileSkeletonProps = DistributiveOmit<StatTileProps, 'state' | 'value'>;

/** The Tile props a StatTile passes through to its root. */
type StatTileRootProps = DistributiveOmit<StatTileProps, StatTileSlot>;

/** The root props once an interactive tile with nowhere to go has become a plain one. */
type StaticRootProps = Omit<StaticTileProps, StatTileSlot>;

const DEFAULT_IDLE_TEXT = 'Nothing right now';
const DEFAULT_ERROR_TEXT = "Couldn't load";
const LOADING_LABEL = 'Loading';
const LIVE_LABEL = 'Live';
const STALE_LABEL = 'Stale';
const ERROR_DASH = '—';

const VALUE_SIZE_CLASS = {
  md: 'text-stat',
  lg: 'text-stat @sm:text-display',
  xl: 'text-display @md:text-hero',
} as const satisfies Record<StatTileSize, string>;

const ROWS_CLASS = 'grid h-full grid-rows-[auto_1fr_auto] gap-3';
const HEAD_CLASS = 'flex items-start justify-between gap-3';
const LABEL_CLASS = 'label-mono text-muted-foreground';
const LIVE_BADGE_CLASS = 'label-mono inline-flex shrink-0 items-center gap-1.5 text-live';
const BODY_CLASS = 'flex min-w-0 flex-col justify-end gap-3';
const FIGURE_CLASS = 'figure text-foreground';
const ERROR_FIGURE_CLASS = 'figure text-muted-foreground';
const UNIT_CLASS = 'ml-1 font-sans text-body-sm font-normal tracking-normal text-muted-foreground';
const IDLE_CLASS = 'font-sans text-title font-medium text-muted-foreground';
const META_CLASS =
  'flex min-h-[1.125rem] flex-wrap items-center gap-x-2 gap-y-1 font-mono text-meta text-muted-foreground';
const VALUE_PLACEHOLDER_CLASS =
  'block h-[1em] w-[4ch] rounded-md bg-surface-3 motion-safe:animate-pulse';
const META_PLACEHOLDER_CLASS = 'block h-3 w-24 rounded-sm bg-surface-3 motion-safe:animate-pulse';
const ICON_CLASS = 'size-3.5 shrink-0';

type DeltaDirection = 'up' | 'down' | 'flat';

/** The arrow is what sighted readers see; the word is what screen readers hear instead. */
const DELTA_COPY = {
  up: { arrow: '▲', word: 'Up' },
  down: { arrow: '▼', word: 'Down' },
  flat: { arrow: '±', word: 'No change' },
} as const satisfies Record<DeltaDirection, { arrow: string; word: string }>;

function resolveState(
  state: StatTileState | undefined,
  shown: number | string | null,
): StatTileState {
  if (state === 'loading' || state === 'error' || state === 'idle') return state;
  return shown === null ? 'idle' : (state ?? 'ready');
}

function deltaDirection(value: number): DeltaDirection {
  if (value > 0) return 'up';
  if (value < 0) return 'down';
  return 'flat';
}

/** An improvement is green and a decline red, each with its arrow and word; no change stays muted. */
function deltaToneClass(direction: DeltaDirection, invert: boolean): string | undefined {
  if (direction === 'flat') return undefined;
  return (direction === 'up') !== invert ? 'text-live' : 'text-down';
}

interface DeltaTextProps {
  delta: StatDelta;
  format?: Intl.NumberFormatOptions;
}

function DeltaText({ delta, format }: DeltaTextProps): ReactElement | null {
  if (!Number.isFinite(delta.value)) return null;
  const direction = deltaDirection(delta.value);
  const { arrow, word } = DELTA_COPY[direction];
  const amount = formatStatValue(Math.abs(delta.value), format);

  return (
    <span
      data-delta={direction}
      className={cn('whitespace-nowrap', deltaToneClass(direction, delta.invert ?? false))}
    >
      <span aria-hidden="true">{arrow}</span>
      <span className="sr-only">{word}</span> {delta.period ? `${amount} ${delta.period}` : amount}
    </span>
  );
}

function LiveBadge(): ReactElement {
  return (
    <span className={LIVE_BADGE_CLASS}>
      <StatusDot tone="live" pulse />
      {LIVE_LABEL}
    </span>
  );
}

interface FigureProps {
  state: StatTileState;
  shown: number | string | null;
  unit?: string;
  format?: Intl.NumberFormatOptions;
  tween: boolean;
  size: StatTileSize;
  idleText: string;
}

/** Row 2. The placeholder sits in the same figure element as the value, so the height matches. */
function Figure({ state, shown, unit, format, tween, size, idleText }: FigureProps): ReactElement {
  const sizeClass = VALUE_SIZE_CLASS[size];

  if (state === 'loading') {
    return (
      <p className={cn(FIGURE_CLASS, sizeClass)}>
        <span aria-hidden="true" className={VALUE_PLACEHOLDER_CLASS} />
        <span className="sr-only">{LOADING_LABEL}</span>
      </p>
    );
  }
  if (state === 'error') {
    // Row 3 says what went wrong; the dash only holds the figure's place.
    return (
      <p className={cn(ERROR_FIGURE_CLASS, sizeClass)}>
        <span aria-hidden="true">{ERROR_DASH}</span>
      </p>
    );
  }
  if (state === 'idle' || shown === null) return <p className={IDLE_CLASS}>{idleText}</p>;

  return (
    <p className={cn(FIGURE_CLASS, sizeClass)}>
      {tween && typeof shown === 'number' ? (
        <LiveNumber value={shown} format={format} />
      ) : (
        formatStatValue(shown, format)
      )}
      {unit && <span className={UNIT_CLASS}>{unit}</span>}
    </p>
  );
}

interface ContextLineProps {
  state: StatTileState;
  meta?: ReactNode;
  updatedAt?: Timestamp;
  delta?: StatDelta;
  format?: Intl.NumberFormatOptions;
  errorText: string;
  action?: ReactNode;
}

/** Row 3: one line of context for the state. */
function ContextLine({
  state,
  meta,
  updatedAt,
  delta,
  format,
  errorText,
  action,
}: ContextLineProps): ReactNode {
  const freshness = updatedAt === undefined ? null : <Freshness at={updatedAt} />;
  const deltaText = delta ? <DeltaText delta={delta} format={format} /> : null;

  switch (state) {
    case 'loading':
      return <span aria-hidden="true" className={META_PLACEHOLDER_CLASS} />;
    case 'error':
      return (
        <>
          <CircleAlert aria-hidden="true" className={cn(ICON_CLASS, 'text-down')} />
          <span>{errorText}</span>
          {action}
        </>
      );
    case 'stale': {
      const note = freshness ?? meta;
      return (
        <>
          <Clock aria-hidden="true" className={ICON_CLASS} />
          <span>{note ? `${STALE_LABEL} ·` : STALE_LABEL}</span>
          {note}
          {deltaText}
        </>
      );
    }
    case 'idle':
      return meta ?? freshness;
    default:
      return (
        <>
          {meta ?? freshness}
          {deltaText}
        </>
      );
  }
}

interface StatTileBodyProps {
  label: ReactNode;
  labelAs: StatTileLabelElement;
  labelId: string;
  showLive: boolean;
  figure: FigureProps;
  context: ContextLineProps;
  children?: ReactNode;
}

function StatTileBody({
  label,
  labelAs: Label,
  labelId,
  showLive,
  figure,
  context,
  children,
}: StatTileBodyProps): ReactElement {
  return (
    <div className={ROWS_CLASS}>
      <div className={HEAD_CLASS}>
        <Label id={labelId} className={LABEL_CLASS}>
          {label}
        </Label>
        {showLive && <LiveBadge />}
      </div>
      <div className={BODY_CLASS}>
        <Figure {...figure} />
        {children}
      </div>
      <div className={META_CLASS}>
        <ContextLine {...context} />
      </div>
    </div>
  );
}

interface StatTileRootOptions {
  tileProps: StatTileRootProps;
  state: StatTileState;
  labelId: string;
  children: ReactNode;
}

interface StaticRootOptions extends Omit<StatTileRootOptions, 'tileProps'> {
  tileProps: StaticRootProps;
}

/** A non-link root: an <article> by default, named by the label. */
function renderStaticRoot({
  tileProps,
  state,
  labelId,
  children,
}: StaticRootOptions): ReactElement {
  // ARIA prohibits naming a generic element, so a div root gets no aria-labelledby.
  const root = tileProps.as ?? 'article';
  return (
    <Tile
      as={root}
      aria-labelledby={root === 'div' ? undefined : labelId}
      {...tileProps}
      data-state={state}
      aria-busy={state === 'loading' || undefined}
    >
      {children}
    </Tile>
  );
}

/**
 * The Tile around the body, named by the label and busy while loading. An interactive tile with
 * no destination keeps the labelled article root of a plain one instead of becoming a bare div.
 */
function renderRoot(options: StatTileRootOptions): ReactElement {
  const { tileProps, state, children } = options;
  if (tileProps.variant !== 'interactive') return renderStaticRoot({ ...options, tileProps });
  if (!hasDestination(tileProps.href)) {
    return renderStaticRoot({ ...options, tileProps: plainTileProps(tileProps) });
  }
  return (
    <Tile {...tileProps} data-state={state} aria-busy={state === 'loading' || undefined}>
      {children}
    </Tile>
  );
}

/**
 * A labelled figure on a Tile, in one of five states. Takes every Tile prop as well: `variant`
 * 'interactive' (with `href`) makes the whole tile a link, which then cannot take `action`. An
 * empty or '#' href renders the plain tile instead (see hasDestination).
 *
 * @example
 * <StatTile label="Typing" value={142} unit="wpm" updatedAt={asOf} labelAs="h2" />
 * <StatTile label="LeetCode" state="error" errorText="LeetCode stats unavailable" action={link} />
 */
export function StatTile(props: StatTileProps): ReactElement {
  const {
    label,
    value,
    unit,
    format,
    state,
    updatedAt,
    meta,
    delta,
    idleText = DEFAULT_IDLE_TEXT,
    errorText = DEFAULT_ERROR_TEXT,
    action,
    live = false,
    tween = false,
    size = 'md',
    labelAs = 'p',
    id,
    children,
    ...tileProps
  } = props;
  const generatedId = useId();
  const labelId = id ?? generatedId;
  const shown = presentValue(value);
  const resolved = resolveState(state, shown);

  const body = (
    <StatTileBody
      label={label}
      labelAs={labelAs}
      labelId={labelId}
      showLive={live && resolved === 'ready'}
      figure={{ state: resolved, shown, unit, format, tween, size, idleText }}
      context={{ state: resolved, meta, updatedAt, delta, format, errorText, action }}
    >
      {children}
    </StatTileBody>
  );
  return renderRoot({ tileProps, state: resolved, labelId, children: body });
}

/** A StatTile in its loading state: the real label, placeholders where the figure and meta go. */
export function StatTileSkeleton(props: StatTileSkeletonProps): ReactElement {
  return <StatTile {...props} state="loading" />;
}
