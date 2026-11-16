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
 * @file 'Where it sits', server-rendered: the project's dot on one time line of every dated
 * project (case-line.ts), between its named neighbours, which are links to their pages. Every mark
 * on the line is named: the years under their ticks, this project with its month, and a small
 * ring for each neighbour, which lights while its link is pointed at or focused. A neighbour from
 * the same month is nudged to its side of the dot (the stylesheet, from --at and --me), so its
 * ring never hides under it. The line itself is a picture (aria-hidden); the neighbours carry its
 * meaning in words. Server-safe.
 */

import { ArrowLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type { CSSProperties, ReactElement } from 'react';

import { projectHref } from '../../_lib/project-text';
import type { Neighbour, ProjectLine } from './case-line';
import styles from './where-it-sits.module.css';

export const SITS_TITLE = 'Where it sits';
const SITS_ID = 'where-it-sits';
/** Near an end, a label is set against that end instead of centred on its tick. */
const EDGE = 0.08;

/** A position on the line as a CSS length. */
const percent = (at: number): string => `${Math.round(at * 10_000) / 100}%`;

/** How a label sits on its tick. */
const anchorOf = (at: number): 'start' | 'end' | 'middle' => {
  if (at < EDGE) return 'start';
  if (at > 1 - EDGE) return 'end';
  return 'middle';
};

interface NeighbourLinkProps {
  readonly neighbour: Neighbour | null;
  readonly side: 'earlier' | 'later';
}

/** '← Earlier / Timeframe / Apr 2024', a link to that project; an empty cell at either end. */
function NeighbourLink({ neighbour, side }: NeighbourLinkProps): ReactElement {
  if (!neighbour) return <span className={styles[side]} />;
  const earlier = side === 'earlier';
  const Arrow = earlier ? ArrowLeft : ArrowRight;
  return (
    <Link
      href={projectHref(neighbour.id)}
      className={`${styles.neighbour} ${styles[side]}`}
      data-case-neighbour={side}
    >
      <span className={styles['neighbour-side']}>
        {earlier ? <Arrow aria-hidden="true" className={styles.arrow} /> : null}
        {earlier ? 'Earlier' : 'Later'}
        {earlier ? null : <Arrow aria-hidden="true" className={styles.arrow} />}
      </span>
      <span className={styles['neighbour-name']}>{neighbour.name}</span>
      <span className={styles['neighbour-month']}>{neighbour.month}</span>
    </Link>
  );
}

/** A neighbour's ring at its day on the line (--at); nothing at an end with no neighbour. */
function NeighbourMark({ neighbour, side }: NeighbourLinkProps): ReactElement | null {
  if (!neighbour) return null;
  return (
    <span
      className={styles.mark}
      data-mark={side}
      style={{ '--at': percent(neighbour.at) } as CSSProperties}
    />
  );
}

/** The line: a tick and a label for each year, the neighbours' rings, this project's dot. */
function Axis({ line }: { readonly line: ProjectLine }): ReactElement {
  return (
    <div
      className={styles.axis}
      aria-hidden="true"
      style={{ '--me': percent(line.at) } as CSSProperties}
    >
      <span className={styles['axis-line']} />
      {line.years.map((year) => (
        <span key={year.label} className={styles.tick} style={{ left: percent(year.at) }} />
      ))}
      <NeighbourMark neighbour={line.earlier} side="earlier" />
      <NeighbourMark neighbour={line.later} side="later" />
      {line.years.map((year, index) => (
        <span
          key={year.label}
          className={styles.year}
          data-anchor={anchorOf(year.at)}
          data-edge={index === 0 || index === line.years.length - 1 ? '' : undefined}
          style={{ left: percent(year.at) }}
        >
          {year.label}
        </span>
      ))}
      <span className={styles.me}>
        <span className={styles['me-label']} data-anchor={anchorOf(line.at)}>
          {line.month}
        </span>
      </span>
    </div>
  );
}

/** The band between the hero and the case study; nothing for a project with no start date. */
export function WhereItSits({ line }: { readonly line: ProjectLine | null }): ReactElement | null {
  if (!line) return null;
  return (
    <section aria-labelledby={SITS_ID} className={styles.sits} data-where-it-sits="">
      <h2 id={SITS_ID} className="sr-only">
        {SITS_TITLE}
      </h2>
      <NeighbourLink neighbour={line.earlier} side="earlier" />
      <Axis line={line} />
      <NeighbourLink neighbour={line.later} side="later" />
    </section>
  );
}
