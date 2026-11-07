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

import 'server-only';

/**
 * @file The home project tile. It follows the owner's own commits on GitHub: the project of the
 * public repository he committed to last, in the last 30 days, labelled 'Latest work' beside the
 * day of that commit ('committed yesterday'). Without one (or without GitHub), the first featured
 * project with a cover, in Studio order (owner decision 7), labelled 'Featured project' beside the
 * year it started. A flush linked tile whose stretched link is the title.
 *
 * The title is split at its first ' - ', ' – ', ' — ' or ': ' (splitTitle): the name is the title
 * and the rest its one description line. A title with no separator takes the first sentence of
 * the project's own description instead (projectSubtitle), so every project has exactly one
 * description line. Nothing else: the rest of the description, the tech chips, the category and
 * the status stay on the project's page.
 *
 * The cover is 2:1, and so is its file: Sanity cuts a 2:1 window from Studio's crop, centred on
 * the image's hotspot (@sanity/image-url's fit, with both a width and a height), so the subject
 * stays in the file and no pixel is sent that the box would throw away. Stacked, the cover is the
 * tile's width. From a 38rem tile the tile is a media object, cover left (half the tile, still
 * 2:1) and text right, so a wide lane does not make the project taller than the hero; a 30rem to
 * 40rem bento (the 30rem estimate tier, where this tile spans the bento) does the same. Below a
 * 30rem bento (phones) it stacks. The text is one line each in every layout (label row, title,
 * description, always all three), so the tile's height depends on its width alone and the
 * skeleton is exactly the tile's size, whatever the project; in the media object the text is
 * never taller than the cover.
 * A stale project (its list served past the deadline) adds that list's day on a line of its own,
 * never cut: it is the tile's only visible sign of staleness, and a stale tile is outside the
 * estimates anyway (tile-states.tsx's state contract).
 *
 * The cover URL is built here, on the server (urlFor never reaches the client). A project with no
 * cover, or one whose image reference cannot be resolved, gets a typographic cover: its initials
 * on a brand gradient. It never says 'No Image Available'.
 */

import Image from 'next/image';
import type { ReactElement } from 'react';

import { hasDestination, Tile, TileLink } from '@/components/console';
import { urlFor } from '@/lib/sanity/client';
import type { Project } from '@/lib/sanity/loaders';
import {
  firstSentence,
  formatAsOfDay,
  formatRelative,
  type Instant,
  splitTitle,
} from '../data/format';
import { loadProjectPick } from '../data/loaders';
import type { ProjectPick } from '../data/selectors';
import type { TileResult } from '../data/tile-result';
import {
  LoadingNote,
  META_SEPARATOR,
  SkeletonLine,
  TileEmpty,
  TileLabel,
  TileMeta,
  TileUnavailable,
} from './tile-states';

const LABEL = 'Featured project';
/**
 * The label when the owner's commits chose the project. It says only what the data shows (he
 * committed to it lately), so it never contradicts the project's own status.
 */
const ACTIVE_LABEL = 'Latest work';
const PROJECTS_PATH = '/projects';

/** The cover file's size: 2:1, as drawn. */
const COVER_WIDTH = 1200;
const COVER_HEIGHT = COVER_WIDTH / 2;
/**
 * How wide the cover is drawn, at most, as a browser reads it before layout: the whole tile below
 * a 30rem bento (stacked, about 100vw), half the tile in a 30rem to 40rem bento (the media object,
 * at most 48vw), then the widest lane the tile can land in: half the bento at medium (at most
 * 47vw), the 1.3fr first lane at wide (at most 35vw), and 436 px once the shell stops growing at
 * 1264 px. A desktop browser's bento is about 10 px narrower than a phone's (globals.css keeps the
 * page scrollbar's gutter), so a step comes in only where both have taken it: the media object
 * from a 527 px window (a phone's from 517 px), the wide tier from 1218 px (a phone's from 1208
 * px). Until then the wider cover counts. bento-areas.test.ts checks it against the grid and this
 * tile's media object, on a phone and in a desktop browser, so it changes with them.
 */
export const PROJECT_COVER_SIZES =
  '(min-width: 1264px) 436px, (min-width: 1218px) 35vw, (min-width: 684px) 47vw, (min-width: 527px) 48vw, 100vw';
const INITIALS_SHOWN = 2;

/**
 * The media object: a column (cover over text), a row from a 38rem tile, and a row in a 30rem to
 * 40rem bento (container `bento`), where the tile spans the bento and a stacked 2:1 cover would
 * make it nearly the hero's size. The 30rem step is the estimate tier's (bento.module.css), so
 * each tier holds one shape. Every class is a literal, for Tailwind's scanner.
 */
const MEDIA_CLASS =
  'flex min-w-0 flex-col @[38rem]:flex-row @min-[30rem]/bento:@max-[40rem]/bento:flex-row';
/**
 * 2:1 and full width, its top corners 1px inside the tile's (the border); as the row's left half,
 * its right corners square and its bottom left one rounded. self-start: in the row it keeps 2:1
 * instead of stretching to the text beside it.
 */
const COVER_CLASS =
  'aspect-[2/1] w-full shrink-0 self-start rounded-t-[calc(var(--radius-tile)-1px)] bg-surface-3 @[38rem]:w-1/2 @[38rem]:rounded-tr-none @[38rem]:rounded-bl-[calc(var(--radius-tile)-1px)] @min-[30rem]/bento:@max-[40rem]/bento:w-1/2 @min-[30rem]/bento:@max-[40rem]/bento:rounded-tr-none @min-[30rem]/bento:@max-[40rem]/bento:rounded-bl-[calc(var(--radius-tile)-1px)]';
const TYPOGRAPHIC_COVER_CLASS = `${COVER_CLASS} flex items-center justify-center bg-[linear-gradient(135deg,var(--brand-subtle),var(--surface-2)_75%)]`;
/** The text, padded like a tile; as the row's right half, centred against the cover. */
const BODY_CLASS =
  'flex min-w-0 flex-col gap-1.5 p-4 @md/bento:p-5 @[38rem]:flex-1 @[38rem]:justify-center @min-[30rem]/bento:@max-[40rem]/bento:flex-1 @min-[30rem]/bento:@max-[40rem]/bento:justify-center';
/**
 * The label and its detail ('Featured project · 2024') as one line box on the label's 16 px line:
 * an inline h2, then the detail, cut with an ellipsis instead of wrapping (as two items of a
 * wrapping row, the detail broke onto a line of its own starting with '·'). In every layout: the
 * detail fits a stacked tile's text from a 254 px column, and the media object's from about a
 * 510 px bento, so only there is 'committed …' cut. Nothing the tile must show goes in it: a
 * stale list's day has a line of its own. (A title here would never show: the stretched link's
 * overlay covers the tile, so a pointer is always over the link.)
 */
const LABEL_ROW_CLASS = 'truncate tile-label text-muted-foreground';
/**
 * The h2 inside the label's line box. Its own nowrap: globals.css gives every h2 `text-wrap:
 * balance`, which sets text-wrap-mode back to wrap, so 'Latest work' broke in two inside the
 * truncated row and the tile grew a line.
 */
const LABEL_CLASS = 'inline whitespace-nowrap';
/**
 * The title and the description: one line each in every layout, cut with an ellipsis, so the
 * tile's height is its width's alone, whatever the copy. Stacked, a two-line title or description
 * made it 20 to 26 px taller than its skeleton and its estimate; in the media object its text
 * (16 + 6 + 26 + 6 + 20 px with 40 px of padding) is never taller than its cover (from 119.5 px at
 * a 30rem bento). The whole title is still the link's name, and the whole line in the DOM.
 */
const TITLE_CLASS = 'line-clamp-1 wrap-break-word tile-title-lg text-foreground';
const SUBTITLE_CLASS = 'line-clamp-1 wrap-break-word tile-sub text-muted-foreground';

/**
 * The description line when the project gives none: neither its title's description, nor a
 * description of its own, nor a category (Studio requires the last two; all 22 projects have
 * both). The tile always has this one line, so it is never shorter than its skeleton.
 */
export const PROJECT_SUBTITLE_FALLBACK = 'Details on the project page';

/** Up to two initials, from the first letters of the title's first words: 'Fraud Guard' is FG. */
export function initialsOf(title: string): string {
  return title
    .split(/[\s\-_/]+/u)
    .filter(Boolean)
    .slice(0, INITIALS_SHOWN)
    .map((word) => Array.from(word)[0]?.toLocaleUpperCase('en-US') ?? '')
    .join('');
}

/**
 * The cover's URL, or null without one: a 2:1 file at the cover's width. With both a width and a
 * height, the builder cuts a 2:1 window from Studio's crop centred on the hotspot (its `rect`),
 * and fit=crop has Sanity serve exactly that window, so the file is the box and the subject stays
 * in it. urlFor throws on an image reference it cannot parse; the typographic cover stands in for
 * it, as for a project with no image.
 */
function coverUrl(image: Project['image']): string | null {
  if (!image?.asset) return null;
  try {
    const url = urlFor(image)
      .width(COVER_WIDTH)
      .height(COVER_HEIGHT)
      .fit('crop')
      .auto('format')
      .url();
    return url || null;
  } catch {
    return null;
  }
}

const projectHref = (project: Project): string =>
  `${PROJECTS_PATH}/${encodeURIComponent(project._id)}`;

/** The year the project started, from its startDate; '' without one. */
const startYear = (project: Project): string => /^\d{4}/u.exec(project.startDate ?? '')?.[0] ?? '';

/**
 * The tile's one description line, never empty: the description in the project's title
 * ('Fraud Guard - AI-Powered Transaction Monitoring'), else the first sentence of its own
 * description in Studio (the latest work's too: it is a Sanity project, matched by its GitHub
 * URL), else its category, else {@link PROJECT_SUBTITLE_FALLBACK}.
 */
export function projectSubtitle(project: Project, subtitle: string): string {
  return (
    subtitle ||
    firstSentence(project.description) ||
    project.category.trim() ||
    PROJECT_SUBTITLE_FALLBACK
  );
}

/** The cover is decorative: the title beside it names the project. */
function Cover({ project, name }: { project: Project; name: string }): ReactElement {
  const url = coverUrl(project.image);
  if (url) {
    return (
      <Image
        src={url}
        alt=""
        width={COVER_WIDTH}
        height={COVER_HEIGHT}
        sizes={PROJECT_COVER_SIZES}
        loading="lazy"
        className={`${COVER_CLASS} object-cover`}
      />
    );
  }
  return (
    <div aria-hidden="true" data-cover="typographic" className={TYPOGRAPHIC_COVER_CLASS}>
      <span className="figure-lg text-foreground">{initialsOf(name)}</span>
    </div>
  );
}

/**
 * 'committed today', 'committed yesterday', 'committed 3 d ago', then 'committed Oct 20', for a
 * project the owner's commits chose; else '' (as for a day it cannot word). A day, not a time:
 * GitHub counts his commits per day.
 */
function committedText(pick: ProjectPick, now: Instant): string {
  if (pick.source !== 'activity') return '';
  const ago = formatRelative(pick.lastCommitDay, now);
  return ago ? `committed ${ago}` : '';
}

interface LabelRowProps {
  label: string;
  /** Beside the label: 'committed yesterday' or '2024'; '' for none. */
  detail: string;
  /** The detail is worded from today's date. */
  dated: boolean;
}

/**
 * The tile's h2 with its detail beside it, so the label's own words never change with the date.
 * One line box: the separator's no-break space (META_SEPARATOR) glues the dot to the label.
 */
function LabelRow({ label, detail, dated }: LabelRowProps): ReactElement {
  return (
    <div className={LABEL_ROW_CLASS}>
      <TileLabel className={LABEL_CLASS}>{label}</TileLabel>
      {detail && (
        <span {...(dated ? { 'data-dated': '' } : {})}>
          <span aria-hidden="true">{META_SEPARATOR}</span>
          {detail}
        </span>
      )}
    </div>
  );
}

interface ProjectViewProps {
  pick: ProjectPick;
  /** The project comes from the list last loaded, served past the deadline. */
  stale: boolean;
  /** 'as of Nov 5' for a stale project whose list's load day is known, else ''. */
  asOf: string;
  now: Instant;
}

function ProjectView({ pick, stale, asOf, now }: ProjectViewProps): ReactElement {
  const { project } = pick;
  const href = projectHref(project);
  const { title, subtitle } = splitTitle(project.title);
  const committed = committedText(pick, now);
  const isActive = pick.source === 'activity';
  return (
    <Tile
      variant={hasDestination(href) ? 'linked' : 'plain'}
      padding="none"
      data-state={stale ? 'stale' : 'ready'}
    >
      <div className={MEDIA_CLASS}>
        <Cover project={project} name={title} />
        <div className={BODY_CLASS}>
          <LabelRow
            label={isActive ? ACTIVE_LABEL : LABEL}
            detail={isActive ? committed : startYear(project)}
            dated={committed !== ''}
          />
          <h3 className={TITLE_CLASS} title={title}>
            <TileLink href={href} className="text-inherit">
              {title}
            </TileLink>
          </h3>
          <p className={SUBTITLE_CLASS}>{projectSubtitle(project, subtitle)}</p>
          {asOf && (
            <TileMeta dated stale>
              {asOf}
            </TileMeta>
          )}
        </div>
      </div>
    </Tile>
  );
}

export interface ProjectTileViewProps {
  result: TileResult<ProjectPick>;
  now?: Instant;
}

/**
 * The owner's latest work (with the day he last committed to it) or the featured project (with
 * its year), or a note with a way to every project. A stale one (from the list last loaded,
 * served past the deadline) says which day that list is from.
 */
export function ProjectTileView({ result, now = Date.now() }: ProjectTileViewProps): ReactElement {
  if (result.status === 'ok') {
    const asOf = result.stale ? formatAsOfDay(result.asOf, now) : '';
    return <ProjectView pick={result.data} stale={result.stale} asOf={asOf} now={now} />;
  }
  const Note = result.status === 'error' ? TileUnavailable : TileEmpty;
  return (
    <Tile className="gap-3" data-state={result.status}>
      <TileLabel>{LABEL}</TileLabel>
      <Note
        message={result.status === 'error' ? 'Projects unavailable' : 'No featured project yet'}
        href={PROJECTS_PATH}
        linkLabel="All projects"
      />
    </Tile>
  );
}

/**
 * The loading project tile, the loaded one's size whatever the project: the cover's 2:1 box (in
 * the same media object), the real label's line, and one line each of the title's and the
 * description's type, as the loaded tile always has.
 */
export function ProjectTileSkeleton(): ReactElement {
  return (
    <Tile padding="none" aria-busy="true" data-state="loading">
      <div className={MEDIA_CLASS}>
        <span aria-hidden="true" className={`${COVER_CLASS} block motion-safe:animate-pulse`} />
        <div className={BODY_CLASS}>
          <LabelRow label={LABEL} detail="" dated={false} />
          <SkeletonLine type="tile-title-lg" bar="h-5 w-3/5" />
          <SkeletonLine type="tile-sub" bar="h-3.5 w-4/5" />
        </div>
      </div>
      <LoadingNote>Loading the featured project</LoadingNote>
    </Tile>
  );
}

export async function ProjectTile(): Promise<ReactElement> {
  return <ProjectTileView result={await loadProjectPick()} />;
}
