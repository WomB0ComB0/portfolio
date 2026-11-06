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
 * @file The home hero: avatar, the page's one h1, the current role, the location, the positioning
 * line and the ways to get in touch. A sync server component, so the h1 is in the first flush.
 *
 * The location, the positioning line and the contact links come from the site settings in
 * Sanity, each falling back to its built-in value ({@link HERO_FALLBACK_COPY}) when it is empty or
 * invalid, or the settings fail to load. They never hold the first flush: each sits in its own
 * Suspense boundary whose fallback is the same markup, filled from the settings this server last
 * loaded (the built-in values before any). So the first flush always has the words and all four
 * links, and on a warm server the content that streams in is the fallback's twin: nothing moves.
 * A new server has nothing cached to match: its first visitors get the built-in copy first, the
 * tagline in a box as tall as Studio's longest tagline at the tile's width (five lines on a phone,
 * three from a 24rem tile), so the owner's longer tagline streaming in moves nothing either.
 * (Loading the settings at startup would not help: instrumentation's register() is awaited before
 * an instance serves any route, so every cold start would wait on Sanity.) Only the tagline can
 * change height: the location sits beside the taller avatar, and the links are always the same
 * four.
 * The role line waits behind a placeholder, in a box that keeps its height.
 */

import Image from 'next/image';
import Link from 'next/link';
import { cache, type ReactElement, Suspense } from 'react';

import { ensureBaseError } from '@/classes/error';
import { StatusDot, Tile } from '@/components/console';
import { app } from '@/constants';
import { reportApiFailure } from '@/lib/observability/report';
import { loadSiteSettings, peekSiteSettings, type SiteSettings } from '@/lib/sanity/loaders';
import { loadCurrentRoles } from '../data/loaders';
import { settle, type TileResult } from '../data/tile-result';
import { PaletteHint } from './palette-hint';
import { ExternalAnchor, GITHUB_PROFILE_URL, SkeletonBar } from './tile-states';

/** The hero's one positioning line (owner decision 7), unless the site settings give a tagline. */
export const HERO_POSITIONING = 'Building web software end to end.';

/** Where the hero says Mike is (shown in capitals), unless the site settings give a location. */
export const HERO_LOCATION = 'New York, NY';

export const HERO_TITLE_ID = 'home-title';

const AVATAR_SRC = 'https://avatars.githubusercontent.com/u/95197809?v=4';
const AVATAR_ALT = "Mike Odnis's avatar: a painting of a scholar writing at his desk";
/** The largest size it is drawn at (size-24). */
const AVATAR_PX = 96;

export const LINKEDIN_PROFILE_URL = 'https://www.linkedin.com/in/mikeodnis/';
const RESUME_PATH = '/resume';

/** What the site settings change in the hero. */
export interface HeroCopy {
  readonly location: string;
  readonly tagline: string;
  readonly email: string;
  readonly githubUrl: string;
  readonly linkedinUrl: string;
}

/** The hero's built-in copy: what it shows without site settings. */
export const HERO_FALLBACK_COPY: HeroCopy = {
  location: HERO_LOCATION,
  tagline: HERO_POSITIONING,
  email: app.email,
  githubUrl: GITHUB_PROFILE_URL,
  linkedinUrl: LINKEDIN_PROFILE_URL,
};

/** The hero's copy from `settings`; each field they lack (empty, or dropped as invalid) built in. */
export function heroCopyOf(settings: SiteSettings | null | undefined): HeroCopy {
  return {
    location: settings?.location ?? HERO_FALLBACK_COPY.location,
    tagline: settings?.tagline ?? HERO_FALLBACK_COPY.tagline,
    email: settings?.email ?? HERO_FALLBACK_COPY.email,
    githubUrl: settings?.githubUrl ?? HERO_FALLBACK_COPY.githubUrl,
    linkedinUrl: settings?.linkedinUrl ?? HERO_FALLBACK_COPY.linkedinUrl,
  };
}

const HERO_TILE = 'hero';

const copyTile = (settings: SiteSettings | null | undefined): TileResult<HeroCopy> => ({
  status: 'ok',
  data: heroCopyOf(settings),
  stale: false,
});

/** The copy the first flush shows, and whether it came from settings this server loaded. */
interface InitialCopy {
  readonly copy: HeroCopy;
  /**
   * False before this server ever loaded the settings (or when reading them failed): the copy
   * streaming in may then differ from the built-in copy shown first.
   */
  readonly loaded: boolean;
}

/**
 * The copy from the settings this server last loaded, however old, without waiting; the built-in
 * copy before any. The hero has no error boundary, so a failure here is reported and falls back.
 */
function lastLoadedCopy(): InitialCopy {
  try {
    const cached = peekSiteSettings();
    return { copy: heroCopyOf(cached?.data), loaded: cached !== undefined };
  } catch (error) {
    reportApiFailure(ensureBaseError(error, `home:${HERO_TILE}`), {
      context: `home ${HERO_TILE} tile`,
    });
    return { copy: HERO_FALLBACK_COPY, loaded: false };
  }
}

/**
 * This request's hero copy, from the site settings. Never throws: a failure is reported like any
 * home tile's (context 'home hero tile') and leaves the built-in copy; past the tile deadline, the
 * copy from the settings last loaded.
 */
export const loadHeroCopy = cache(async (): Promise<HeroCopy> => {
  const result = await settle(HERO_TILE, async () => copyTile(await loadSiteSettings()), {
    onDeadline: () => copyTile(peekSiteSettings()?.data),
  });
  return result.status === 'ok' ? result.data : HERO_FALLBACK_COPY;
});

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

interface CopyProps {
  readonly copy: HeroCopy;
}

type CopyView = (props: CopyProps) => ReactElement;

/** Beside the avatar, in capitals. min-w-0 lets a long one wrap instead of widening the row. */
function HeroLocation({ copy }: CopyProps): ReactElement {
  return <p className="label-mono min-w-0 text-muted-foreground">{copy.location}</p>;
}

/** The tagline's type size, on its box too, so the box's `lh` is the tagline's line. */
const TAGLINE_TYPE_CLASS = 'text-body @xl:text-title';

/**
 * The tagline's box when nothing is cached ({@link InitialCopy}): as many tagline lines as
 * Studio's longest (120 characters) wraps to at the tile's width, so the owner's tagline replaces
 * the built-in one without moving anything below it. Otherwise as tall as the tagline.
 *
 * Measured in Chromium with Geist at 16/26 px, against the tile's content width: five lines below
 * 18rem (238 px on a 320 px phone), four up to 24rem (293 px at 375 px; some still four at
 * 360 px), three from 24rem, where the 40ch measure and, from 36rem, the title size hold it there.
 */
export const TAGLINE_SLOT_RESERVED_CLASS = `min-h-[5lh] @2xs:min-h-[4lh] @sm:min-h-[3lh] ${TAGLINE_TYPE_CLASS}`;

function HeroTagline({ copy }: CopyProps): ReactElement {
  return (
    <p className={`max-w-[40ch] text-pretty text-muted-foreground ${TAGLINE_TYPE_CLASS}`}>
      {copy.tagline}
    </p>
  );
}

function HeroLinks({ copy }: CopyProps): ReactElement {
  return (
    <ul className="flex flex-wrap gap-2">
      <li>
        <a href={`mailto:${copy.email}`} className={PRIMARY_LINK_CLASS}>
          Email me
        </a>
      </li>
      <li>
        <ExternalAnchor href={copy.githubUrl} className={GHOST_LINK_CLASS}>
          GitHub
        </ExternalAnchor>
      </li>
      <li>
        <ExternalAnchor href={copy.linkedinUrl} className={GHOST_LINK_CLASS}>
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

async function LoadedCopy({ view: View }: { readonly view: CopyView }): Promise<ReactElement> {
  return <View copy={await loadHeroCopy()} />;
}

/**
 * `view` with this request's settings, streamed in. Until they load, the same `view` with
 * `initial`, so the first flush has it and the swap moves nothing when the two agree.
 */
function CopySlot({
  initial,
  view: View,
}: {
  readonly initial: HeroCopy;
  readonly view: CopyView;
}): ReactElement {
  return (
    <Suspense fallback={<View copy={initial} />}>
      <LoadedCopy view={View} />
    </Suspense>
  );
}

/** The dominant tile of the bento. The h1 never takes the brand colour. */
export function HeroTile(): ReactElement {
  const { copy: initial, loaded } = lastLoadedCopy();
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
        <CopySlot initial={initial} view={HeroLocation} />
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
        <div data-hero-tagline-slot className={loaded ? undefined : TAGLINE_SLOT_RESERVED_CLASS}>
          <CopySlot initial={initial} view={HeroTagline} />
        </div>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-3">
        <CopySlot initial={initial} view={HeroLinks} />
        <PaletteHint />
      </div>
    </Tile>
  );
}
