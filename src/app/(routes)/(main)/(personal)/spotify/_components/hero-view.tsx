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
 * @file The /spotify now-playing hero, drawn from a HeroState. Presentational: no directive and no
 * hooks, so the live island renders it and the lab renders its samples on the server.
 *
 * It is the home now-playing tile's body at hero scale: the album art, then the track over its
 * artist, with the equaliser before the artist as the only live cue (moving for a few seconds when
 * a track starts, then at rest; still otherwise, and still under reduced motion), the same copy and
 * the same link rules (the whole tile links to the track on Spotify, in a new tab). Above the
 * track, a sentence-case label says when: "Playing now" or "Recently played · 3 h ago". That label
 * is the tile's h2, so a screen reader hears the state once. Every state, nothing playing included,
 * is the same tile with the same art box, so a poll never changes the hero's height.
 *
 * The art is sized in pixels (80px, 112px from a 28rem tile), so enlarged text does not double
 * it. Once the tile is under nine lines of its own text wide (at the browser's own size only under
 * a 300px phone, 310px with a mouse; from about 125% text on a 320px phone, 150% on a 412px one)
 * the title wraps instead of being cut at one line, and the art moves above the words wherever
 * beside them a long word would not fit (ROW_CLASS). The title then gets the lines a long title
 * needs at that width (TEXT_CLASS). In every layout the words keep the room the tallest state
 * needs, so a poll keeps the height at any text size, and a track's artist line keeps its place
 * when a title takes more lines.
 *
 * The equaliser is the home tile's own component, from its server-safe module beside the
 * stylesheet. Nothing comes from the tile's 'use client' module at runtime: on the server each of
 * its exports, even a string, would arrive as a client reference.
 */

import type { ReactElement, ReactNode } from 'react';
import { Equaliser } from '@/app/_components/home/live/equaliser';
import type { PlayingTrackView } from '@/app/_components/home/live/now-playing-view';
import { Freshness } from '@/components/console/freshness';
import { Tile } from '@/components/console/tile';
import { TileLink } from '@/components/console/tile-link';
import Image from '@/components/ui/cdn-image';
import { cn } from '@/lib/utils';
import type { HeroState } from '../_lib/hero-state';
import { ArtBacklight, type ArtMode } from './art-backlight';
import { ArtGlyph } from './equaliser';

/** The art's largest drawn size; next/image picks the file for it. */
const ART_PX = 112;
/** The visible "when" words; screen readers hear " on Spotify" after "Playing now". */
const PLAYING_LABEL = 'Playing now';
const SPOKEN_SERVICE = ' on Spotify';
const RECENT_TITLE = 'Recently played';
/** The screen-reader heading of the one state with no label of its own to carry it. */
const QUIET_TITLE = 'Now playing';

/** The art and its glyph, in pixels so enlarged text leaves them be: 80px, 112px from a 28rem tile. */
const ART_BOX_CLASS = 'size-[80px] shrink-0 rounded-lg @md:size-[112px] @md:rounded-xl';
/**
 * Art beside the words. Under nine lines of the tile's text wide (at the browser's own size only
 * under a 300px phone) it moves above them wherever beside it the title's box would not hold a
 * 12-letter word whole: 5.375 lines of the tile's text at the title's size, after the 80px art and
 * its 1rem gap ("Megalomaniac" on today's chart takes 5.25 to 5.37 lines with the root font
 * enlarged, 5.31 with a phone's text at 150%). A phone's text size setting grows lh but not rem or
 * px, so this follows it: with phone text at 150% the art stays beside the words from a 375px
 * phone and goes above them on a 360px one, where it broke that word in two; at 200% it is above
 * them on every phone. From a 28rem tile (the 112px art, a larger title) it is above them all
 * through that band. Beside the art the tile is shorter by the art's height and a gap, 96px.
 */
const ROW_CLASS = [
  'flex min-w-0 items-center gap-4 @md:gap-6',
  '@max-[9lh]:@max-[calc(80px+1rem+5.375lh)]:flex-col @max-[9lh]:@max-[calc(80px+1rem+5.375lh)]:items-start',
  '@max-[9lh]:@md:flex-col @max-[9lh]:@md:items-start',
].join(' ');
/**
 * The words, which keep the tallest state's room in every state, so a poll never changes the
 * hero's height, at any text size. The room is counted in lines of the words' own 1rem line
 * (lh), which grows with the text however it is enlarged (a phone's text size setting grows line
 * heights but not rem lengths):
 * - nine lines wide and more, beside the art, the label (1rem) over a title of two lines, which
 *   "Listening on Spotify" takes in a narrow tile, with a 0.25rem gap: 4.5 lines (1.625rem title
 *   lines), 5.25 on a 28rem tile (2rem). A track's one-line title and its artist fit inside that,
 *   and so do a quiet state's title and its line of two. The words sit in its middle. At the
 *   browser's own size the art (80px, 112px) is taller than that room, so nothing moves;
 * - under nine lines wide (at the browser's own size only under a 300px phone), beside the art or
 *   under it: the label kept to one line (RecentLabel's short words), the title's lines
 *   (--hero-title-lines) and the artist, with two gaps: 2.25 lines, 1.625 for each title line,
 *   and 0.5rem (2.5 and 2 on a 28rem tile). A track's label and title start at the top and its
 *   artist line keeps the bottom (TRACK_TEXT_CLASS, SUB_CLASS), so a title that takes another
 *   line moves nothing; the quiet states, whose title and line take up to six lines on the
 *   narrowest tile, sit in the middle.
 *
 * The title's lines are what a 33-letter title ("Club classics featuring bb trickz", the longest
 * on today's chart) needs in its box, counted in lines of the tile's text, with phone text at 200%
 * (the widest-set text): two from 6.875 lines wide (it needs 6.8), three from 5 (4.9) and four
 * under that. Beside the art the box is the tile less 80px and 1rem, so three lines there; above
 * it the box is the tile's whole width; from a 28rem tile (a larger title) three.
 */
const TEXT_CLASS = [
  'flex min-w-0 flex-1 flex-col justify-center gap-1 leading-4',
  '[--hero-title-lines:2] @max-[5lh]:[--hero-title-lines:4] @min-[5lh]:@max-[6.875lh]:[--hero-title-lines:3]',
  '@min-[calc(80px+1rem+5.375lh)]:@max-[calc(80px+1rem+6.875lh)]:[--hero-title-lines:3] @md:@max-[9lh]:[--hero-title-lines:3]',
  '@min-[9lh]:min-h-[4.5lh] @min-[9lh]:@md:min-h-[5.25lh]',
  '@max-[9lh]:min-h-[calc((2.25+1.625*var(--hero-title-lines))*1lh+0.5rem)]',
  '@max-[9lh]:@md:min-h-[calc((2.5+2*var(--hero-title-lines))*1lh+0.5rem)]',
  '@max-[9lh]:@max-[calc(80px+1rem+5.375lh)]:w-full @max-[9lh]:@md:w-full',
].join(' ');
/** A track's (or the unknown playing's) words, under nine lines wide: from the top (see above). */
const TRACK_TEXT_CLASS = cn(TEXT_CLASS, '@max-[9lh]:justify-start');
/**
 * The "when" label: always one line (a label that wrapped would make its state taller than the
 * others); RecentLabel shortens its words where the whole of them would not fit.
 */
const LABEL_CLASS = 'truncate tile-label text-muted-foreground';
/**
 * The track: the project tile's title size, a step up on a wide tile. A word breaks inside only
 * when it is wider than its whole line (enlarged text in a narrow tile). Under nine lines wide,
 * the title is this box's lines (--hero-title-lines, TEXT_CLASS) with an ellipsis after the last,
 * and the link inside runs inline, so the new-tab arrow follows the last word instead of standing
 * apart at the far right. No hyphens: they would also split words that fit the next line whole.
 */
const TITLE_CLASS =
  'min-w-0 tile-title-lg [overflow-wrap:anywhere] @md:text-[1.625rem] @md:leading-8 @md:tracking-[-0.025em] @max-[9lh]:line-clamp-(--hero-title-lines)';
/**
 * A track's title box: under nine lines wide the clamp clips only below its lines, not at its
 * sides, so the arrow (which takes no room on the line, TRACK_LINK_CLASS) can hang past a last
 * word that fills its line, into the tile's padding, instead of going alone onto the next line.
 */
const TRACK_TITLE_BOX_CLASS = cn(
  TITLE_CLASS,
  '@max-[9lh]:overflow-x-visible @max-[9lh]:overflow-y-clip',
);
/** The artist line; under nine lines wide it keeps the bottom of the words' room. */
const SUB_CLASS =
  'flex min-w-0 items-center gap-2 tile-sub text-muted-foreground @md:text-base @max-[9lh]:mt-auto';
/**
 * The track link: the truncated title and TileLink's arrow, brand-ink while the tile is hovered.
 * Under nine lines wide it is inline in the title's lines (above), and the arrow takes no room
 * on the line (its 1rem, the icon and its gap, given back by the margin), so it always fits after
 * the last word. There the arrow is its own small box: as an inline run its word joiner reported
 * the whole line as moving whenever a new title moved the arrow, a layout shift of up to 0.03.
 */
const TRACK_LINK_CLASS =
  'flex min-w-0 items-baseline text-foreground transition-colors duration-(--motion-base) ease-effect group-hover/tile:text-brand-ink group-hover/tile:duration-(--motion-instant) @max-[9lh]:inline @max-[9lh]:[&_[data-new-tab-arrow]]:inline-block @max-[9lh]:[&_[data-new-tab-arrow]]:-me-4';
/** The track's title: one line from nine lines wide; under that, inline words that wrap. */
const TRACK_TITLE_CLASS = 'min-w-0 truncate @max-[9lh]:inline @max-[9lh]:whitespace-normal';
/** The quiet states' titles: a word breaks only when it is wider than its line. */
const QUIET_TITLE_CLASS = 'tile-title [overflow-wrap:anywhere]';
/**
 * The unreachable state's line, short on purpose as "Nothing playing"'s is: two lines at most
 * beside the art. Nine lines wide and more the words keep the art's height, which holds a one-line
 * title and those two lines but not a title of two lines, so the line goes only where "Spotify
 * unreachable" would wrap beside the art: under 6.05 lines of the tile's text after the art and its
 * gap. The title takes 5.80 lines unhinted (a phone, a Mac) and 5.95 hinted (Linux) at the
 * browser's own size, at most 6.04 from 100 to 123% text, so the line never shows beside a title of
 * two lines. On a touch screen it shows from a 320px phone, with a mouse (a 10px narrower tile)
 * from a 330px window. Under nine lines wide the room holds a title of two lines or more, so the
 * line always has room there, above the art or beside it.
 */
const UNREACHABLE_LINE_CLASS =
  'tile-sub text-muted-foreground @min-[9lh]:@max-[calc(80px+1rem+6.05lh)]:hidden';

export interface HeroViewProps {
  readonly state: HeroState;
  /** Album-art colour: inside the images only (default), or a faint glow from the art too. */
  readonly art?: ArtMode;
}

interface TrackHeroProps {
  readonly track: PlayingTrackView;
  readonly state: 'playing' | 'recent';
  /** The visible line above the track, which is also the tile's h2. */
  readonly label: ReactNode;
  readonly art: ArtMode;
}

/**
 * The album art at hero size, or the glyph when Spotify sent none: its bars move while the track
 * plays, as the small bars beside the artist do, so the two cues never disagree. Decorative.
 *
 * The hero is the page's first tile and its art is the largest image above the fold (the
 * largest paint from 768px up), so it loads at once and ahead of the images below it. No preload
 * link: the art changes with the track, and a link would be left behind for each one.
 */
function HeroArt({
  imageURL,
  live,
}: {
  readonly imageURL?: string;
  readonly live: boolean;
}): ReactElement {
  if (!imageURL) return <ArtGlyph className={ART_BOX_CLASS} live={live} />;
  return (
    <Image
      src={imageURL}
      alt=""
      width={ART_PX}
      height={ART_PX}
      sizes={`${ART_PX}px`}
      loading="eager"
      fetchPriority="high"
      className={cn(ART_BOX_CLASS, 'bg-surface-3 object-cover')}
    />
  );
}

/** "Playing now", heard as "Playing now on Spotify" (the home tile's words for its heading). */
function PlayingLabel(): ReactElement {
  return (
    <>
      {PLAYING_LABEL}
      <span className="sr-only">{SPOKEN_SERVICE}</span>
    </>
  );
}

/**
 * A track, playing or recently played. The whole tile is one link to it when it has a Spotify
 * page (a linked tile, which lifts on hover); otherwise a plain tile that never looks clickable.
 */
function TrackHero({ track, state, label, art }: TrackHeroProps): ReactElement {
  const live = state === 'playing';
  return (
    <Tile variant={track.href ? 'linked' : 'plain'} data-spotify-hero="" data-state={state}>
      {art === 'glow' && track.imageURL && <ArtBacklight src={track.imageURL} />}
      <div className={ROW_CLASS}>
        <HeroArt imageURL={track.imageURL} live={live} />
        <div className={TRACK_TEXT_CLASS}>
          <h2 data-hero-label="" className={LABEL_CLASS}>
            {label}
          </h2>
          <p className={TRACK_TITLE_BOX_CLASS}>
            <TileLink
              href={track.href ?? ''}
              external
              srSuffix={track.spokenSuffix}
              className={TRACK_LINK_CLASS}
            >
              <span className={TRACK_TITLE_CLASS}>{track.title}</span>
            </TileLink>
          </p>
          <p className={SUB_CLASS}>
            <Equaliser size="inline" live={live} />
            <span className="min-w-0 truncate">{track.subtitle}</span>
          </p>
        </div>
      </div>
    </Tile>
  );
}

/**
 * "Recently played · 3 h ago"; the age stays current while the page is open. On a tile under
 * 17.5rem (a 320px phone) the whole line does not fit beside the art, so it reads
 * "Recent · 3 h ago" there, and so it does on a tile under nine lines of its text wide (enlarged
 * text), where the label keeps one line. A screen reader hears "Recently played, 3 h ago" at
 * every width.
 */
function RecentLabel({ at }: { readonly at: number }): ReactElement {
  return (
    <>
      <span className="sr-only">{RECENT_TITLE}, </span>
      <span
        aria-hidden="true"
        data-recent-words="full"
        className="@max-[17.5rem]:hidden @max-[9lh]:hidden"
      >
        {RECENT_TITLE} ·{' '}
      </span>
      <span
        aria-hidden="true"
        data-recent-words="short"
        className="hidden @max-[17.5rem]:inline @max-[9lh]:inline"
      >
        Recent ·{' '}
      </span>
      {/*
       * Freshness draws a tile-meta <time>, whose taller line would win over tile-label's and
       * make this state's label taller than "Playing now". It takes the label's line instead, so
       * every state's label is one height and the label fits the words' room.
       */}
      <Freshness at={at} prefix="" className="tile-label [line-height:inherit]" />
    </>
  );
}

/** Playing, but not a track (an episode or an ad): the glyph's bars move, nothing is linked. */
function PlayingUnknown(): ReactElement {
  return (
    <Tile variant="plain" data-spotify-hero="" data-state="playing-unknown">
      <div className={ROW_CLASS}>
        <ArtGlyph className={ART_BOX_CLASS} live />
        <div className={TRACK_TEXT_CLASS}>
          <h2 data-hero-label="" className={LABEL_CLASS}>
            <PlayingLabel />
          </h2>
          <p className={cn(TITLE_CLASS, 'text-foreground')}>Listening on Spotify</p>
        </div>
      </div>
    </Tile>
  );
}

/** Spotify did not answer. Faint, not red: red means a site outage (the status tile's). */
function Unreachable(): ReactElement {
  return (
    <Tile variant="plain" data-spotify-hero="" data-state="unreachable">
      <h2 className="sr-only">{QUIET_TITLE}</h2>
      <div className={ROW_CLASS}>
        <ArtGlyph className={ART_BOX_CLASS} />
        <div className={TEXT_CLASS}>
          <p className={cn(QUIET_TITLE_CLASS, 'text-faint')}>Spotify unreachable</p>
          {/* Gone only where the title takes two lines beside the art: the title says it then. */}
          <p className={UNREACHABLE_LINE_CLASS}>Back as soon as Spotify answers.</p>
        </div>
      </div>
    </Tile>
  );
}

/**
 * Nothing plays and no track was seen lately. Quiet, and in the tile the other states use (the
 * glyph in the art's box, a title and one line), so a song starting or a failed poll changes the
 * tile's words but never its height or what sits below it.
 */
function NothingPlaying(): ReactElement {
  return (
    <Tile variant="plain" data-spotify-hero="" data-state="nothing">
      <div className={ROW_CLASS}>
        <ArtGlyph className={ART_BOX_CLASS} />
        <div className={TEXT_CLASS}>
          <h2 className={cn(QUIET_TITLE_CLASS, 'text-foreground')}>Nothing playing</h2>
          {/* Short on purpose: a line that wraps past the art's height would change the tile's. */}
          <p className="tile-sub text-muted-foreground">Spotify is quiet right now.</p>
        </div>
      </div>
    </Tile>
  );
}

/**
 * What I'm listening to, one design per state.
 *
 * @example
 * <HeroView state={heroState(view, recent)} art="plain" />
 */
export function HeroView({ state, art = 'plain' }: HeroViewProps): ReactElement {
  switch (state.kind) {
    case 'playing':
      return <TrackHero track={state} state="playing" label={<PlayingLabel />} art={art} />;
    case 'recent':
      return (
        <TrackHero
          track={state.track}
          state="recent"
          label={<RecentLabel at={state.at} />}
          art={art}
        />
      );
    case 'playing-unknown':
      return <PlayingUnknown />;
    case 'nothing':
      return <NothingPlaying />;
    case 'unreachable':
      return <Unreachable />;
  }
}
