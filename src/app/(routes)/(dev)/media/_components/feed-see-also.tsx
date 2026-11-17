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
 * @file A /media row's "see also" line: what the row points at, as real links in the server HTML,
 * always in the same order and never more than one of each relation. Server-safe: no directive,
 * no hooks.
 *
 * - Its other version, only when the feed holds one (media-pairing.ts): "Video version: <title>"
 *   on a post, "Written version: <title>" on a video. The link goes straight to the other piece,
 *   in a new tab. On a phone the title is left to screen readers and the label alone shows. With
 *   the embed option a "Video version" opens the in-page player instead, as a video's title does.
 * - Its series: "Series: Upload 14 of 27", or "Part 1 of 2" when the titles number themselves
 *   ("Series: <name>" past the channel listing's cap, where no place can be vouched for). The
 *   link shows only that series, first part first (?series=, so it can be shared and works
 *   without JavaScript). A reference is a link only where it leads somewhere else and is not one
 *   of many alike: where the list already holds every upload of the series (the series view, the
 *   full list, or a kind or a search that finds them all), on the rows of a long series cut to its
 *   newest uploads (the line that closes them links it) and on all but the first row of a long
 *   series listed in part, the place is said as text instead ("Upload 14 of 27"), outside the
 *   "see also" list (feed-series-ref.tsx picks).
 * - Its project (media-projects.ts): "Project: <title>", a link to the project's page on this
 *   site, which lists the row back.
 * - Its topics (media-topic-index.ts), three at most: each a link to everything filed under it
 *   (?topic=).
 * A row that points at nothing has no line at all. Every link's text names what it leads to, so
 * it reads on its own ("Video version: Portfolio - revamp 3 - 2025"), and nothing here is hidden
 * behind a hover.
 */

import Link from 'next/link';
import type { ReactElement, ReactNode } from 'react';
import { NEW_TAB_LABEL, NewTabArrow, SrOnlyWords } from '@/components/console/tile-link';
import { LinkHealthBadge } from '@/components/link-health/link-health-badge';
import type { FeedPair, FeedProject, FeedRow, FeedSeries, FeedTopic } from '../_lib/media-feed';
import type { PlayMode } from '../_lib/media-options';
import {
  SEE_ALSO_CLASS,
  SEE_ITEM_CLASS,
  SEE_LABEL_CLASS,
  SEE_LEAD_CLASS,
  SEE_LINE_CLASS,
  SEE_LINK_CLASS,
  SEE_NAME_CLASS,
  SEE_PLACE_CLASS,
  SEE_PROPOSED_CLASS,
  SEE_TEXT_CLASS,
} from './feed-classes';
import { playAttributes } from './feed-play';
import { SeriesReference } from './feed-series-ref';

/** The line's name: what opens it on screen, and what a screen reader calls the list. */
export const SEE_ALSO_LABEL = 'See also';

/**
 * "Upload 14 of 27" when the series is numbered by date, "Part 1 of 2" by its own titles. Where
 * the list is not complete (past the channel listing's cap), the page can vouch for neither a
 * place nor a count (more uploads of the series may be past the cap), so the series' name alone.
 */
export const seriesWords = (
  { part, count, numbered, name }: FeedSeries,
  complete = true,
): string => (complete ? `${numbered === 'title' ? 'Part' : 'Upload'} ${part} of ${count}` : name);

/** The link's tooltip: "Show all 27, first to last"; past the cap, "Show all listed uploads". */
const seriesTooltip = (series: FeedSeries, complete: boolean): string =>
  complete ? `Show all ${series.count}, first to last` : 'Show all listed uploads';

/** Whether the other piece is filmed (so the link reads "Video version") or written. */
const isFilmed = (pair: FeedPair): boolean => pair.kind === 'video' || pair.kind === 'stream';

/** "Video version" on a written row, "Written version" on a filmed one. */
export const pairWords = (pair: FeedPair): string =>
  isFilmed(pair) ? 'Video version' : 'Written version';

/** A project's page on this site. */
export const projectHref = (project: Pick<FeedProject, 'id'>): string =>
  `/projects/${encodeURIComponent(project.id)}`;

export interface PairLinkProps {
  readonly pair: FeedPair;
  readonly play: PlayMode;
}

/**
 * The link to a row's other version, named in full: "Video version: <its title> (opens in a new
 * tab)". The title shows whole from a 40rem page, wrapping like any other reference when the
 * line is too short for it; on a phone only a screen reader gets it (and a mouse its tooltip).
 * The new-tab arrow sits in the run of the words, glued to the last one (the kit's word joiner),
 * so on a title that wraps it ends the last line instead of floating beside all of them.
 */
export function PairLink({ pair, play }: PairLinkProps): ReactElement {
  const inPlace = playAttributes(pair, play, pair.title);
  return (
    <span className="inline-flex max-w-full flex-wrap items-baseline gap-x-1">
      <a
        href={pair.href}
        data-feed-pair={pair.kind}
        title={pair.title}
        className={SEE_LINK_CLASS}
        {...(inPlace ?? { target: '_blank', rel: 'noopener noreferrer' })}
      >
        <span className={SEE_TEXT_CLASS}>
          {pairWords(pair)}
          <span className={SEE_NAME_CLASS}>: {pair.title}</span>
          {!inPlace && <NewTabArrow />}
        </span>
        {!inPlace && <SrOnlyWords>{NEW_TAB_LABEL}</SrOnlyWords>}
      </a>
      {pair.kind !== 'video' && pair.kind !== 'stream' && (
        <LinkHealthBadge href={pair.href} scope="media" />
      )}
    </span>
  );
}

export interface SeriesLinkProps {
  readonly series: FeedSeries;
  /** The page's URL showing only this series. */
  readonly href: string;
  /** False past the channel listing's cap: the series' count is then not stated. */
  readonly complete?: boolean;
}

/**
 * A row's place in its series, as the link to the whole series. A screen reader also hears the
 * series' name, joined by a word ("Series: Upload 14 of 27 in <name>"): hidden words are a box of
 * their own, read after a pause, so joined by a comma they were announced with a space before it
 * ("Upload 14 of 27 , <name>"). Past the cap the link shows the name itself ("Series: <name>").
 */
export function SeriesLink({ series, href, complete = true }: SeriesLinkProps): ReactElement {
  return (
    <Link
      href={href}
      prefetch={false}
      data-feed-series=""
      title={seriesTooltip(series, complete)}
      className={SEE_LINK_CLASS}
    >
      <span className={SEE_TEXT_CLASS}>
        Series: {seriesWords(series, complete)}
        {complete && <span className="sr-only"> in {series.name}</span>}
      </span>
    </Link>
  );
}

export interface SeriesPlaceProps {
  readonly series: FeedSeries;
  /** False past the channel listing's cap: the series' count is then not stated. */
  readonly complete?: boolean;
}

/**
 * A row's place in its series as text ("Upload 3 of 27"), for a list where the link would lead
 * nowhere new: the list already holds every upload of the series, or a row or the line under a
 * long series links it. Past the cap, with no place to say, the series it is in ("Series: <name>").
 */
export function SeriesPlace({ series, complete = true }: SeriesPlaceProps): ReactElement {
  return (
    <span data-feed-series-place="" className={SEE_PLACE_CLASS}>
      {complete ? seriesWords(series) : `Series: ${seriesWords(series, false)}`}
    </span>
  );
}

/** The link to the project a row is about; a proposal (the lab only) says that it is one. */
export function ProjectLink({ project }: { readonly project: FeedProject }): ReactElement {
  return (
    <Link
      href={projectHref(project)}
      prefetch={false}
      data-feed-project={project.id}
      className={SEE_LINK_CLASS}
    >
      <span className={SEE_TEXT_CLASS}>Project: {project.title}</span>
      {project.proposed && (
        <>
          {' '}
          <span data-feed-proposed="" className={SEE_PROPOSED_CLASS}>
            proposed
          </span>
        </>
      )}
    </Link>
  );
}

export interface TopicLinksProps {
  readonly topics: readonly FeedTopic[];
  /** The page's URL showing only what is filed under a topic. */
  readonly topicHref: (slug: string) => string;
}

/** "Topics:" and a link for each; a screen reader hears "Topic: <label>" on every link. */
export function TopicLinks({ topics, topicHref }: TopicLinksProps): ReactElement {
  return (
    <>
      <span aria-hidden="true" className={SEE_LABEL_CLASS}>
        {topics.length === 1 ? 'Topic:' : 'Topics:'}
      </span>
      {topics.map((topic) => (
        <Link
          key={topic.slug}
          href={topicHref(topic.slug)}
          prefetch={false}
          data-feed-topic={topic.slug}
          className={SEE_LINK_CLASS}
        >
          <span className="sr-only">Topic: </span>
          <span className={SEE_TEXT_CLASS}>{topic.label}</span>
        </Link>
      ))}
    </>
  );
}

/**
 * The "see also" line: the words that open it, then the list they name, which holds the
 * references and nothing else. The words stand beside the list, not in it, so a long reference
 * wraps beside them; a phone leaves them out (SEE_LEAD_CLASS).
 */
function SeeAlsoList({ children }: { readonly children: ReactNode }): ReactElement {
  return (
    <div className={SEE_LINE_CLASS}>
      <span aria-hidden="true" data-feed-see-lead="" className={SEE_LEAD_CLASS}>
        {SEE_ALSO_LABEL}
      </span>
      <ul data-feed-see-also="" aria-label={SEE_ALSO_LABEL} className={SEE_ALSO_CLASS}>
        {children}
      </ul>
    </div>
  );
}

export interface FeedSeeAlsoProps {
  readonly row: FeedRow;
  readonly play: PlayMode;
  /** The page's URL showing only the row's series; null when it is in none. */
  readonly seriesHref: string | null;
  /** The page's URL showing only what is filed under a topic. */
  readonly topicHref: (slug: string) => string;
  /** False when the row's kind is listed only in part (past the channel listing's cap). */
  readonly complete?: boolean;
}

/**
 * The "see also" line of a row: its other version, its series, its project, then its topics.
 * Nothing when the row points at none of them. A row in a series is rendered both ways, and the
 * list it is shown in picks: with the series as a link, or with its place said as text above
 * whatever else the row points at (see the file comment).
 */
export function FeedSeeAlso({
  row,
  play,
  seriesHref,
  topicHref,
  complete = true,
}: FeedSeeAlsoProps): ReactElement | null {
  const { pair, project, topics } = row;
  const before = pair && (
    <li className={SEE_ITEM_CLASS}>
      <PairLink pair={pair} play={play} />
    </li>
  );
  const after = (
    <>
      {project && (
        <li className={SEE_ITEM_CLASS}>
          <ProjectLink project={project} />
        </li>
      )}
      {topics.length > 0 && (
        <li className={SEE_ITEM_CLASS}>
          <TopicLinks topics={topics} topicHref={topicHref} />
        </li>
      )}
    </>
  );
  const others = pair !== null || project !== null || topics.length > 0;
  const withoutSeries = others ? (
    <SeeAlsoList>
      {before}
      {after}
    </SeeAlsoList>
  ) : null;
  if (row.series === null || seriesHref === null) return withoutSeries;
  return (
    <SeriesReference
      rowId={row.id}
      linked={
        <SeeAlsoList>
          {before}
          <li className={SEE_ITEM_CLASS}>
            <SeriesLink series={row.series} href={seriesHref} complete={complete} />
          </li>
          {after}
        </SeeAlsoList>
      }
      plain={
        <>
          <SeriesPlace series={row.series} complete={complete} />
          {withoutSeries}
        </>
      }
    />
  );
}
