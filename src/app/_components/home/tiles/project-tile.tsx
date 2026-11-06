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
 * @file The home featured-project tile: the first featured project with a cover, in Studio
 * order (owner decision 7). A flush linked tile whose stretched link is the title.
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
import { loadFeaturedProject } from '../data/loaders';
import type { TileResult } from '../data/tile-result';
import {
  joinMeta,
  LoadingNote,
  SkeletonBar,
  TileEmpty,
  TileLabel,
  TileMeta,
  TileUnavailable,
} from './tile-states';

const LABEL = 'Featured project';
const PROJECTS_PATH = '/projects';

const COVER_WIDTH = 1200;
const COVER_HEIGHT = 750;
/**
 * How wide the cover is drawn, from the bento's proj area inside the shell: the whole content
 * box below a 40rem bento (about 100vw), 3 of 6 columns up to the 67.5rem bento (half the bento
 * less 8 px: at most 47vw), then 5 of 12 columns (37vw, and 464 px once the shell stops growing
 * at 1264 px). The bento switches by its own width, which the gutters put 44 px below a 684 px
 * viewport, and the rail and gutters 128 px below a 1208 px one. bento-areas.test.ts checks this
 * against the grid at every viewport width.
 */
export const PROJECT_COVER_SIZES =
  '(min-width: 1264px) 464px, (min-width: 1208px) 37vw, (min-width: 684px) 47vw, 100vw';
const TECH_CHIPS_SHOWN = 4;
const INITIALS_SHOWN = 2;

/** The tile's border is 1px inside its radius, so the cover's corners sit 1px tighter. */
const COVER_CLASS = 'aspect-[16/10] w-full rounded-t-[calc(var(--radius-tile)-1px)]';
const TYPOGRAPHIC_COVER_CLASS = `${COVER_CLASS} flex flex-col justify-between bg-[linear-gradient(135deg,var(--brand-subtle),var(--surface-2)_75%)] p-5`;
const BODY_CLASS = 'flex flex-1 flex-col gap-2 p-4 @md:p-5';
const TITLE_CLASS = 'line-clamp-2 wrap-break-word text-title font-semibold text-foreground';
const DESCRIPTION_CLASS = 'line-clamp-2 wrap-break-word text-body-sm text-muted-foreground';
const CHIP_CLASS =
  'rounded-sm border border-hairline px-1.5 py-0.5 font-mono text-label text-muted-foreground';

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
 * The cover's URL, or null without one. urlFor throws on an image reference it cannot parse; the
 * typographic cover stands in for it, the same as for a project with no image.
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

/** The year the project started, from its startDate; undefined without one. */
const startYear = (project: Project): string | undefined =>
  /^\d{4}/u.exec(project.startDate ?? '')?.[0];

function Cover({ project }: { project: Project }): ReactElement {
  const url = coverUrl(project.image);
  if (url) {
    return (
      <Image
        src={url}
        alt={project.image?.alt ?? ''}
        width={COVER_WIDTH}
        height={COVER_HEIGHT}
        sizes={PROJECT_COVER_SIZES}
        loading="lazy"
        className={`${COVER_CLASS} object-cover`}
      />
    );
  }
  // Decorative: the title and category are in the body below.
  return (
    <div aria-hidden="true" data-cover="typographic" className={TYPOGRAPHIC_COVER_CLASS}>
      <span className="label-mono text-brand-ink">{project.category}</span>
      <span className="font-sans text-[4rem] font-extrabold leading-none tracking-display text-foreground">
        {initialsOf(project.title)}
      </span>
    </div>
  );
}

function TechChips({ technologies }: { technologies: readonly string[] }): ReactElement | null {
  const shown = technologies.slice(0, TECH_CHIPS_SHOWN);
  if (shown.length === 0) return null;
  return (
    <ul aria-label="Technologies" className="flex flex-wrap gap-1.5">
      {shown.map((technology) => (
        <li key={technology} className={CHIP_CLASS}>
          {technology}
        </li>
      ))}
    </ul>
  );
}

function ProjectView({ project }: { project: Project }): ReactElement {
  const href = projectHref(project);
  return (
    <Tile variant={hasDestination(href) ? 'linked' : 'plain'} padding="none">
      <Cover project={project} />
      <div className={BODY_CLASS}>
        <TileLabel>{LABEL}</TileLabel>
        <h3 className={TITLE_CLASS}>
          <TileLink href={href} className="text-inherit">
            {project.title}
          </TileLink>
        </h3>
        <p className={DESCRIPTION_CLASS}>{project.description}</p>
        <TechChips technologies={project.technologies} />
        <TileMeta className="pt-1">
          {joinMeta([project.category, project.status, startYear(project)])}
        </TileMeta>
      </div>
    </Tile>
  );
}

export interface ProjectTileViewProps {
  result: TileResult<Project>;
}

/** The featured project, or a note with a way to every project. */
export function ProjectTileView({ result }: ProjectTileViewProps): ReactElement {
  if (result.status === 'ok') return <ProjectView project={result.data} />;
  const Note = result.status === 'error' ? TileUnavailable : TileEmpty;
  return (
    <Tile className="gap-3" data-state={result.status}>
      <TileLabel>{LABEL}</TileLabel>
      <Note
        className="mt-auto"
        message={result.status === 'error' ? 'Projects unavailable' : 'No featured project yet'}
        href={PROJECTS_PATH}
        linkLabel="All projects"
      />
    </Tile>
  );
}

/** The loading project tile: the cover's box, the real label and bars for the text. */
export function ProjectTileSkeleton(): ReactElement {
  return (
    <Tile padding="none" aria-busy="true" data-state="loading">
      <SkeletonBar className={`${COVER_CLASS} rounded-b-none`} />
      <div className={BODY_CLASS}>
        <TileLabel>{LABEL}</TileLabel>
        <SkeletonBar className="h-7 w-3/5" />
        <SkeletonBar className="h-4 w-full" />
        <SkeletonBar className="h-4 w-4/5" />
        <SkeletonBar className="mt-auto h-3 w-40 rounded-sm" />
      </div>
      <LoadingNote>Loading the featured project</LoadingNote>
    </Tile>
  );
}

export async function ProjectTile(): Promise<ReactElement> {
  return <ProjectTileView result={await loadFeaturedProject()} />;
}
