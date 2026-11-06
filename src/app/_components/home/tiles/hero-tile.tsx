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
 * @file The home hero: avatar, the page's one h1, the current role, the positioning line and the
 * ways to get in touch. A sync server component, so the h1 is in the first flush; only the role
 * line waits for its data, behind its own Suspense, in a box that keeps its height.
 */

import Image from 'next/image';
import Link from 'next/link';
import { type ReactElement, Suspense } from 'react';

import { StatusDot, Tile } from '@/components/console';
import { app } from '@/constants';
import { loadCurrentRoles } from '../data/loaders';
import { PaletteHint } from './palette-hint';
import { ExternalAnchor, GITHUB_PROFILE_URL, SkeletonBar } from './tile-states';

/** The hero's one positioning line (owner decision 7). */
export const HERO_POSITIONING = 'Building web software end to end.';

export const HERO_TITLE_ID = 'home-title';

const AVATAR_SRC = 'https://avatars.githubusercontent.com/u/95197809?v=4';
const AVATAR_ALT = "Mike Odnis's avatar: a painting of a scholar writing at his desk";
/** The largest size it is drawn at (size-24). */
const AVATAR_PX = 96;

export const LINKEDIN_PROFILE_URL = 'https://www.linkedin.com/in/mikeodnis/';
const RESUME_PATH = '/resume';

/**
 * 44 px tall at every width, so each is a comfortable touch target. Text only: no brand icons.
 * The filled one is brand with canvas text; the ghost ones are hairline outlines.
 */
const LINK_BASE_CLASS =
  'inline-flex h-11 items-center gap-1 rounded-full px-4 text-body-sm font-medium transition-colors duration-(--motion-fast) ease-standard';
const PRIMARY_LINK_CLASS = `${LINK_BASE_CLASS} bg-brand px-5 font-semibold text-canvas hover:bg-brand-ink`;
const GHOST_LINK_CLASS = `${LINK_BASE_CLASS} border border-hairline text-foreground hover:border-hairline-strong hover:bg-surface-3`;

/**
 * Two lines below a 36rem hero (a long role wraps there), one above: the role line streams in
 * after the first flush, and the box keeps the hero from moving when it lands or stays empty.
 */
const ROLE_SLOT_CLASS = 'min-h-[3em] text-body @xl:min-h-[1.5em]';
const ROLE_LINE_CLASS = 'flex items-baseline gap-2 leading-[1.5] text-foreground';
const NOW_BADGE_CLASS = 'label-mono inline-flex shrink-0 items-center gap-1.5 text-ongoing';

/**
 * '{position} at {company}' for the first current role in Studio order, beside an amber dot and
 * the word 'Now'. Nothing when no role is current or the roles failed to load: the hero reads
 * fine without it, and the roles tile shows that error.
 */
export async function HeroRoleLine(): Promise<ReactElement | null> {
  const result = await loadCurrentRoles();
  const role = result.status === 'ok' ? result.data.roles[0] : undefined;
  if (!role) return null;
  return (
    <p className={ROLE_LINE_CLASS}>
      <span className={NOW_BADGE_CLASS}>
        <StatusDot tone="ongoing" />
        Now
      </span>
      <span className="line-clamp-2 min-w-0">
        {role.position} at {role.company}
      </span>
    </p>
  );
}

function HeroLinks(): ReactElement {
  return (
    <ul className="flex flex-wrap gap-2">
      <li>
        <a href={`mailto:${app.email}`} className={PRIMARY_LINK_CLASS}>
          Email me
        </a>
      </li>
      <li>
        <ExternalAnchor href={GITHUB_PROFILE_URL} className={GHOST_LINK_CLASS}>
          GitHub
        </ExternalAnchor>
      </li>
      <li>
        <ExternalAnchor href={LINKEDIN_PROFILE_URL} className={GHOST_LINK_CLASS}>
          LinkedIn
        </ExternalAnchor>
      </li>
      <li>
        <Link href={RESUME_PATH} prefetch={false} className={GHOST_LINK_CLASS}>
          Résumé
        </Link>
      </li>
    </ul>
  );
}

/** The dominant tile of the bento. The h1 never takes the brand colour. */
export function HeroTile(): ReactElement {
  return (
    <Tile variant="raised" tone="hero" padding="lg" className="h-full gap-6">
      <div className="flex items-center gap-4">
        <Image
          src={AVATAR_SRC}
          alt={AVATAR_ALT}
          width={AVATAR_PX}
          height={AVATAR_PX}
          sizes={`${AVATAR_PX}px`}
          loading="eager"
          fetchPriority="high"
          className="size-18 shrink-0 rounded-full ring-2 ring-brand @xl:size-24"
        />
        <p className="label-mono text-muted-foreground">New York, NY</p>
      </div>
      <div className="flex flex-col gap-3">
        <h1
          id={HERO_TITLE_ID}
          className="font-sans text-[clamp(2.5rem,0.75rem+11cqi,6rem)] font-extrabold leading-[0.95] tracking-display text-foreground"
        >
          Mike Odnis
        </h1>
        <div className={ROLE_SLOT_CLASS}>
          <Suspense fallback={<SkeletonBar className="h-[1.5em] w-3/5" />}>
            <HeroRoleLine />
          </Suspense>
        </div>
        <p className="max-w-[40ch] text-pretty text-body text-muted-foreground @xl:text-title">
          {HERO_POSITIONING}
        </p>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-3">
        <HeroLinks />
        <PaletteHint />
      </div>
    </Tile>
  );
}
