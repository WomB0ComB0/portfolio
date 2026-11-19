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
 * @file The /spotify artist strip: the top ten artists as small round portraits with their rank
 * and name, each a link to the artist on Spotify (new tab). Server-safe (no directive, no
 * hooks), so it is in the server HTML.
 *
 * On a phone the strip scrolls sideways inside itself (snapping, edge to edge, faded at the far
 * edge as the cue that there is more, until the last artist is in), so the page never scrolls
 * sideways. From a 53.5rem page it is a row of ten. Hover is the tile hover's motion on the portrait alone: a 3px lift on the
 * no-bounce spring with the brand rim and halo, and the name in brand-ink; nothing scales.
 * Palette only: the portraits are the only colour.
 */

import type { ReactElement } from 'react';
import { EmptyState } from '@/components/console/empty-state';
import {
  INDEX_YEAR_COUNT_CLASS,
  INDEX_YEAR_NUMBER_CLASS,
} from '@/components/console/index-table/index-table-classes';
import { NEW_TAB_LABEL, SrOnlyWords } from '@/components/console/tile-link';
import { RetryButton } from '@/components/data/retry-button';
import { SectionError } from '@/components/data/section-error';
import Image from '@/components/ui/cdn-image';
import { cn } from '@/lib/utils';
import {
  ARTIST_PORTRAIT_PX,
  ARTISTS_SHOWN,
  type ChartArtist,
  type ChartListResult,
} from '../_lib/chart';
import { ArtGlyph } from './equaliser';
import { SECTION_HEAD_GROW_CLASS } from './track-table';

const HEADING_ID = 'spotify-top-artists';

/**
 * The h2: the IndexTable year bar's type, flush on the page content axis so both section heads
 * line up with the page header and cards, and, as the tracks bar does, its growing form on a page
 * under ten lines wide: with text enlarged the qualifier wraps under the heading instead of the
 * two overflowing the 40px bar (at the browser's own size it is still 40px).
 */
const HEADING_CLASS = cn('flex h-10 items-end gap-2.5 pb-1', SECTION_HEAD_GROW_CLASS);
/**
 * The list: a phone's edge-to-edge scroller (the page gutter becomes its padding, so the first
 * portrait lines up with the text above), a ten-up grid from a 53.5rem page. The grid has no gap
 * until a 59rem page (the cards' own padding keeps the portraits apart), so each card gets at least
 * 80px there (a 48rem grid squeezed them to 69px); a scroller that wide showed nine portraits and
 * the tenth half-faded, which read as cut off rather than as more to come. The top padding keeps
 * the hover lift inside the scroller, which clips.
 *
 * A card (--card) is 3.5 lines of the strip's own 24px line wide (84px at the browser's own size),
 * so it grows with the text however the text is enlarged: a phone's text size setting
 * (text-size-adjust) grows line heights but not rem lengths, so a rem card stayed 84px while its
 * names doubled and broke inside words. The list and its cards set that line height themselves.
 * With the text enlarged a few cards fill a phone, and from 1.8 to 2.5 of them across (a 390px
 * phone at 200%) the third was off screen or a sliver under the fade, so nothing said there were
 * more: there the cards narrow to show two and a half (CARD_HALF_CLASS). Never at the browser's
 * own size, where that band is under 240px.
 *
 * The mask is the scroll cue: 3rem fading out at the far edge ("there is more"), and the gutter
 * fading in at the near edge, which is empty at rest and softens the cut of a card scrolled past
 * it. The end padding is the gutter plus that 3rem, so the last card can scroll clear of the fade.
 *
 * Keyboard: Chrome does not scroll to a focused card that is partly inside the scroll-padding
 * box. So the scroll padding is the gutter plus one card and its gap on both sides: a card left
 * unscrolled is then always whole inside the strip, and one outside the box is scrolled in. That
 * much start padding lands every snap on the same positions as the gutter alone (the previous
 * card sits at the gutter). It is capped at half the strip less half a card, so the box between
 * the paddings is never narrower than a card: on a 320px phone with 200% text two paddings of a
 * whole card each met in the middle, and Chrome left the second card cut. The fade lifts while a
 * card shows its focus ring.
 */
const LIST_CLASS = [
  '-mx-(--page-gutter) flex snap-x snap-mandatory gap-1 overflow-x-auto ps-(--page-gutter) pe-[calc(var(--page-gutter)+3rem)] pt-1 pb-2 leading-6 [--card:3.5lh]',
  'scroll-px-[min(calc(var(--page-gutter)+var(--card)+0.25rem),calc(100%-var(--card)))]',
  '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
  '[mask-image:linear-gradient(90deg,transparent,#000_var(--page-gutter),#000_calc(100%-3rem),transparent)]',
  'has-[:focus-visible]:[mask-image:none]',
  '@min-[53.5rem]/page:mx-0 @min-[53.5rem]/page:grid @min-[53.5rem]/page:grid-cols-10 @min-[53.5rem]/page:gap-0 @min-[53.5rem]/page:overflow-visible @min-[53.5rem]/page:ps-0 @min-[53.5rem]/page:pe-0 @min-[53.5rem]/page:[mask-image:none] @min-[59rem]/page:gap-1',
].join(' ');
/**
 * Two and a half cards across where 1.8 to 2.5 of them would fit (the page's own line is 26px to
 * the strip's 24px, so 3.5 strip lines are 3.23 page lines; a phone's gutter is 1rem): the strip
 * width less the gutter, over 2.5, less the gap. Inside the scroller only (under a 53.5rem page).
 */
const CARD_HALF_CLASS =
  '@min-[calc(5.82lh+1.45rem)]/page:@max-[calc(8.08lh+1.625rem)]/page:[--card:calc((100cqi-var(--page-gutter))/2.5-0.25rem)]';
/**
 * One card, --card wide (see above). The last snaps by its end instead; its end margin reaches
 * past the end padding, so that snap is held at the very end of the scroll, where the last card
 * sits clear of the fade. Without it the mandatory snap would pull the strip back off its end.
 */
const ITEM_CLASS =
  'w-(--card) flex-none snap-start leading-6 last:snap-end last:scroll-me-[calc(var(--page-gutter)+3rem)] @min-[53.5rem]/page:w-auto';
/**
 * The link: the portrait over the name. The ring is the site's one focus ring (no outline-none:
 * in Tailwind v4 it sets the outline style that outline-2 reuses, so no ring would draw), drawn
 * inside the card so the scroller can't clip it.
 */
const CARD_CLASS =
  'group/artist flex flex-col items-center gap-2 rounded-lg px-1 py-1.5 text-center focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus';
/**
 * The portrait's box: the tile hover's lift (translate on --ease-spring, in over
 * --motion-spring-in and back over --motion-spring-out, a press drops back at once, no lift under
 * reduced motion) and its light (a hairline at rest; the brand rim and halo on hover, faded on
 * --ease-effect).
 */
const FACE_CLASS = [
  'relative block rounded-full shadow-[0_0_0_1px_var(--hairline)]',
  'transition-[translate,box-shadow] ease-[var(--ease-spring),var(--ease-effect)] duration-[var(--motion-spring-out),var(--motion-slow)]',
  'group-hover/artist:-translate-y-0.75 group-hover/artist:shadow-[0_0_0_1px_var(--brand-rim),0_10px_24px_-10px_var(--brand-halo)] group-hover/artist:duration-[var(--motion-spring-in),var(--motion-base)]',
  'group-active/artist:translate-y-0 group-active/artist:duration-(--motion-instant)',
  'motion-reduce:group-hover/artist:translate-y-0',
].join(' ');
/** The portrait and its glyph: 56px in the scroller, 64px in the row of ten (a 59rem page). */
const PORTRAIT_CLASS = 'size-14 rounded-full @min-[59rem]/page:size-16';
/**
 * The rank and name, three lines at most, then an ellipsis. A one-word name wider than the card
 * (XXXTENTACION) breaks inside instead of being sliced at the card's edge, and shows whole on the
 * third line ("3", "XXXTENTA", "CION"); with two lines the clamp's ellipsis, added after a centred
 * line, ran past the card and was cut to a dot. Names that fit two lines (all of them today) are
 * unchanged.
 */
const NAME_CLASS =
  'line-clamp-3 w-full text-balance [overflow-wrap:anywhere] tile-sub text-foreground transition-colors duration-(--motion-base) ease-effect group-hover/artist:text-brand-ink group-hover/artist:duration-(--motion-instant)';
const RANK_CLASS = 'tabular-nums text-faint';

/** The portrait, or the still glyph when Spotify sent none. Decorative: the name is beside it. */
function Portrait({ image }: { readonly image?: string }): ReactElement {
  return (
    <span className={FACE_CLASS}>
      {image ? (
        <Image
          src={image}
          alt=""
          width={ARTIST_PORTRAIT_PX}
          height={ARTIST_PORTRAIT_PX}
          sizes={`${ARTIST_PORTRAIT_PX}px`}
          className={cn(PORTRAIT_CLASS, 'bg-surface-3 object-cover')}
        />
      ) : (
        <ArtGlyph className={PORTRAIT_CLASS} />
      )}
    </span>
  );
}

/** The rank and the name; the space keeps the link's name "1 potsu". */
function ArtistName({ artist }: { readonly artist: ChartArtist }): ReactElement {
  return (
    <span data-artist-name="" className={NAME_CLASS}>
      <span className={RANK_CLASS}>{artist.rank}</span> {artist.name}
    </span>
  );
}

/** One artist: a link out when Spotify sent a page for them, otherwise the same card as text. */
function ArtistCard({ artist }: { readonly artist: ChartArtist }): ReactElement {
  if (!artist.href) {
    return (
      <div className={CARD_CLASS}>
        <Portrait image={artist.image} />
        <ArtistName artist={artist} />
      </div>
    );
  }
  return (
    <a href={artist.href} target="_blank" rel="noopener noreferrer" className={CARD_CLASS}>
      <Portrait image={artist.image} />
      <ArtistName artist={artist} />
      <SrOnlyWords>{NEW_TAB_LABEL}</SrOnlyWords>
    </a>
  );
}

/** The section's h2, styled as the tracks table's year bar: "Top artists, last four weeks". */
function StripHeading(): ReactElement {
  return (
    <h2 id={HEADING_ID} className={HEADING_CLASS}>
      <span className={INDEX_YEAR_NUMBER_CLASS}>Top artists</span>
      <span className="sr-only">,</span>{' '}
      <span className={INDEX_YEAR_COUNT_CLASS}>last four weeks</span>
    </h2>
  );
}

export interface ArtistStripProps {
  readonly result: ChartListResult<ChartArtist>;
}

/**
 * The top artists of the last four weeks; its own error (with Try again) or empty state when
 * Spotify failed or sent none, without touching the rest of the page.
 *
 * @example
 * <ArtistStrip result={await loadTopArtistsChart()} />
 */
export function ArtistStrip({ result }: ArtistStripProps): ReactElement {
  if (result.status === 'error') {
    return (
      <SectionError title="Couldn't load top artists" headingLevel={2} action={<RetryButton />} />
    );
  }
  if (result.data.length === 0) {
    return (
      <EmptyState title="No top artists yet">
        Spotify has no chart for the last four weeks.
      </EmptyState>
    );
  }
  return (
    <section aria-labelledby={HEADING_ID} className="flex min-w-0 flex-col gap-1">
      <StripHeading />
      <ol className={cn(LIST_CLASS, CARD_HALF_CLASS)}>
        {result.data.slice(0, ARTISTS_SHOWN).map((artist) => (
          <li key={artist.key} data-spotify-artist="" className={ITEM_CLASS}>
            <ArtistCard artist={artist} />
          </li>
        ))}
      </ol>
    </section>
  );
}
