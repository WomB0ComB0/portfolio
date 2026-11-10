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
 * @file The home hero: the avatar beside the page's one h1, the role line, the positioning line
 * and the ways to get in touch. A sync server component, so the h1 is in the first flush.
 *
 * The role line is '{position}, {company} · {location}': the first current role in Studio order,
 * its company as people say it ('ResQ Systems', not 'ResQ Systems, Inc.'), then quietly, in the
 * muted colour, where Mike is, from the site settings (owner decision: show it quietly). It
 * streams in after the first flush behind a placeholder, in a box that keeps its height, and is
 * clamped to the lines that box reserves.
 *
 * The location has no built-in value (owner decision: 'Clear the field in Studio to hide it'). A
 * settings document without one (cleared, blank or invalid), or no document, shows no location;
 * when Sanity fails, the last good settings this server cached decide, and with nothing cached
 * there is none. So a location the owner cleared never comes back through a fallback.
 *
 * The positioning line and the contact links come from the site settings in Sanity, each falling
 * back to its built-in value ({@link HERO_FALLBACK_COPY}) when it is empty or invalid, or the
 * settings fail to load. The tagline and the links never hold the first flush, so it always has
 * the words and all four links. On a warm server they are rendered from the settings this server
 * last loaded, as they are, outside Suspense: the reload the role line starts once those are past
 * their TTL shows from the next request, so nothing streams in and nothing moves. A new server
 * has nothing cached: its first visitors get the built-in copy first, each in a Suspense boundary
 * the owner's copy streams into, the tagline in a box as tall as Studio's longest tagline at the
 * tile's width (five lines on a phone, three from a 24rem tile), so the owner's longer tagline
 * streaming in moves nothing either. (Loading the settings at startup would not help:
 * instrumentation's register() is awaited before an instance serves any route, so every cold
 * start would wait on Sanity.) The links are always the same four.
 */

import Image from 'next/image';
import Link from 'next/link';
import { cache, type ReactElement, Suspense } from 'react';

import { ensureBaseError } from '@/classes/error';
import { Tile } from '@/components/console';
import { app } from '@/constants';
import { reportApiFailure } from '@/lib/observability/report';
import { loadSiteSettings, peekSiteSettings, type SiteSettings } from '@/lib/sanity/loaders';
import { companyName } from '../data/format';
import { loadCurrentRoles } from '../data/loaders';
import { settle, type TileResult } from '../data/tile-result';
import { ExternalAnchor, GITHUB_PROFILE_URL, META_SEPARATOR, SkeletonBar } from './tile-states';

/**
 * The hero's one positioning line (owner decision 7), unless the site settings give a tagline.
 * Kept in app.tagline, which the link-preview card and the web app manifest repeat.
 */
export const HERO_POSITIONING = app.tagline;

export const HERO_TITLE_ID = 'home-title';

const AVATAR_SRC = 'https://avatars.githubusercontent.com/u/95197809?v=4';
const AVATAR_ALT = "Mike Odnis's avatar: a painting of a scholar writing at his desk";
/** The largest size it is drawn at (size-18, from a 30rem tile). */
const AVATAR_PX = 72;

export const LINKEDIN_PROFILE_URL = 'https://www.linkedin.com/in/mikeodnis/';
const RESUME_PATH = '/resume';

/** What the site settings change in the hero. */
export interface HeroCopy {
  /** Where Mike is, after the role; null shows none. Never built in: only the settings say it. */
  readonly location: string | null;
  readonly tagline: string;
  readonly email: string;
  readonly githubUrl: string;
  readonly linkedinUrl: string;
}

/** The hero's built-in copy: what it shows without site settings. No location: that is private. */
export const HERO_FALLBACK_COPY: HeroCopy = {
  location: null,
  tagline: HERO_POSITIONING,
  email: app.email,
  githubUrl: GITHUB_PROFILE_URL,
  linkedinUrl: LINKEDIN_PROFILE_URL,
};

/**
 * The hero's copy from `settings`; each field they lack (empty, or dropped as invalid) built in,
 * except the location, which they alone give: without one, there is none.
 */
export function heroCopyOf(settings: SiteSettings | null | undefined): HeroCopy {
  return {
    location: settings?.location ?? null,
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
   * then streams in, and may differ from the built-in copy shown first. True once loaded: the copy
   * is shown as is for the whole request, even past the cache's TTL.
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
 * 14/20 at 500, the filled one too: brand with canvas text; the ghost ones are hairline outlines.
 */
const LINK_BASE_CLASS =
  'inline-flex h-11 items-center gap-1 rounded-full px-4 text-sm font-medium transition-colors duration-(--motion-fast) ease-standard';
const PRIMARY_LINK_CLASS = `${LINK_BASE_CLASS} bg-brand px-5 text-canvas hover:bg-brand-ink`;
const GHOST_LINK_CLASS = `${LINK_BASE_CLASS} border border-hairline text-foreground hover:border-hairline-strong hover:bg-surface-3`;

/**
 * The role line's box, in the role line's type so its `lh` is the line's: two lines below a 28rem
 * hero content box (the line wraps on a phone), one from there. 'Founder & CEO, ResQ Systems · New
 * York, NY' is about 390 px at 18 px, so it fits on one line from 28rem (448 px) with room to
 * spare; a 32rem step left an empty line under it in a 30 to 32rem hero (a 600 px viewport). The
 * line streams in after the first flush, and the box keeps the hero from moving when it lands or
 * stays empty.
 */
const ROLE_SLOT_CLASS = 'hero-role min-h-[2lh] @md:min-h-[1lh]';
/**
 * The role line, clamped to the lines its box reserves, at the same steps: Studio takes a
 * 40-character location and any position, which unclamped took a third line on a phone and a
 * second from 28rem, so the hero grew when the line streamed in. The muted location ends the
 * line, inside the clamp, so a long one is cut first, with an ellipsis; the whole line stays in
 * the DOM for screen readers. wrap-break-word: an unbroken word breaks instead of overflowing.
 */
const ROLE_LINE_CLASS = 'hero-role line-clamp-2 wrap-break-word text-foreground @md:line-clamp-1';

/** '{position}, {company}' for a role, its company as people say it; '' without either. */
function roleText(role: { position: string; company: string } | undefined): string {
  if (!role) return '';
  return [role.position.trim(), companyName(role.company)].filter(Boolean).join(', ');
}

/**
 * 'Founder & CEO, ResQ Systems · New York, NY': the first current role in Studio order, then the
 * location from the site settings, muted. Either alone when the other is missing (no role is
 * current or the roles failed; the owner cleared the location, or the settings failed with
 * nothing cached), with no separator left over, and nothing without both: the hero reads fine
 * without it, and the roles tile shows the roles' error.
 */
export async function HeroRoleLine(): Promise<ReactElement | null> {
  const [roles, copy] = await Promise.all([loadCurrentRoles(), loadHeroCopy()]);
  const role = roleText(roles.status === 'ok' ? roles.data.roles[0] : undefined);
  const location = copy.location?.trim() ?? '';
  if (!(role || location)) return null;
  return (
    <p className={ROLE_LINE_CLASS}>
      {role}
      {location && (
        <span data-hero-location="" className="text-muted-foreground">
          {role ? META_SEPARATOR : null}
          {location}
        </span>
      )}
    </p>
  );
}

interface CopyProps {
  readonly copy: HeroCopy;
}

type CopyView = (props: CopyProps) => ReactElement;

/** The tagline's type, on its box too, so the box's `lh` is the tagline's line. */
const TAGLINE_TYPE_CLASS = 'hero-tagline';

/**
 * The tagline's box when nothing is cached ({@link InitialCopy}): as many tagline lines as
 * Studio's longest (120 characters) wraps to at the tile's width, so the owner's tagline replaces
 * the built-in one without moving anything below it. Otherwise as tall as the tagline. The
 * reserved box carries data-state 'loading' (tile-states.tsx's state contract): it is not the
 * hero's reference height.
 *
 * Measured in Chromium with Geist at 16 px, against the tile's content width: five lines below
 * 18rem (238 px on a 320 px phone), four up to 24rem (293 px at 375 px; some still four at
 * 360 px), three from 24rem, where the 40ch measure holds it there. The line is 24 px; the count
 * of lines depends on the size only.
 */
export const TAGLINE_SLOT_RESERVED_CLASS = `min-h-[5lh] @2xs:min-h-[4lh] @sm:min-h-[3lh] ${TAGLINE_TYPE_CLASS}`;

/** wrap-break-word: a word too long for the tile's width breaks instead of overflowing it. */
function HeroTagline({ copy }: CopyProps): ReactElement {
  return (
    <p className={`max-w-[40ch] wrap-break-word text-muted-foreground ${TAGLINE_TYPE_CLASS}`}>
      {copy.tagline}
    </p>
  );
}

/**
 * The mailto link for `email`. A mail client decodes %XX in the address, so a literal '%' (which
 * SITE_EMAIL_PATTERN allows) goes as %25: first%2Blast@ stays that, not first+last@.
 */
const mailtoHref = (email: string): string => `mailto:${email.replaceAll('%', '%25')}`;

function HeroLinks({ copy }: CopyProps): ReactElement {
  return (
    <ul className="flex flex-wrap gap-2">
      <li>
        <a href={mailtoHref(copy.email)} className={PRIMARY_LINK_CLASS}>
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

/**
 * `view` in the first flush. On a server that has loaded the settings, with those settings as
 * they are, outside Suspense: past the cache's TTL the reload waits for Sanity, so streaming its
 * answer in could swap a tagline of another length into a box that reserves nothing. The reload
 * {@link HeroRoleLine} starts (through loadHeroCopy) shows from the next request instead. Before
 * any load, streamed in through {@link CopySlot}, where only the tagline has a reserved box.
 */
function SettingsCopy({
  initial,
  loaded,
  view: View,
}: {
  readonly initial: HeroCopy;
  readonly loaded: boolean;
  readonly view: CopyView;
}): ReactElement {
  return loaded ? <View copy={initial} /> : <CopySlot initial={initial} view={View} />;
}

/**
 * The dominant tile of the bento, and the only large one. It hugs its content: the avatar beside
 * the name (the name wraps under it when they do not fit), the role and positioning lines, then
 * the links. The h1 never takes the brand colour.
 */
export function HeroTile(): ReactElement {
  const { copy: initial, loaded } = lastLoadedCopy();
  return (
    <Tile variant="raised" tone="hero" padding="lg" className="gap-5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-4">
        <Image
          src={AVATAR_SRC}
          alt={AVATAR_ALT}
          width={AVATAR_PX}
          height={AVATAR_PX}
          sizes={`${AVATAR_PX}px`}
          loading="eager"
          fetchPriority="high"
          className="size-16 shrink-0 rounded-full ring-2 ring-brand @[30rem]:size-18"
        />
        <h1 id={HERO_TITLE_ID} className="min-w-0 hero-name text-foreground">
          Mike Odnis
        </h1>
      </div>
      <div className="flex max-w-[40rem] flex-col gap-1">
        <div data-hero-role-slot="" className={ROLE_SLOT_CLASS}>
          <Suspense fallback={<SkeletonBar className="h-[1lh] w-3/5" />}>
            <HeroRoleLine />
          </Suspense>
        </div>
        <div
          data-hero-tagline-slot
          data-state={loaded ? undefined : 'loading'}
          className={loaded ? undefined : TAGLINE_SLOT_RESERVED_CLASS}
        >
          <SettingsCopy initial={initial} loaded={loaded} view={HeroTagline} />
        </div>
      </div>
      <SettingsCopy initial={initial} loaded={loaded} view={HeroLinks} />
    </Tile>
  );
}
