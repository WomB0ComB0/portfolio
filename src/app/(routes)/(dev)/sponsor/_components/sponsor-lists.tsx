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
 * @file The part of /sponsor that depends on GitHub: the current sponsors card and the past
 * sponsors, plus the skeleton that holds their place while they load. Presentational (no data
 * loading, no hooks); the async Sponsors component in ./sponsors.tsx feeds it.
 */

import { ExternalLink, Heart, Sparkles } from 'lucide-react';
import Image from 'next/image';
import type { ReactElement } from 'react';

import type {
  GitHubSponsorsData,
  Sponsor as SponsorEntry,
  SponsorGroups,
  SponsorListsProps,
} from '@/app/(routes)/(dev)/sponsor/_interface/sponsor/sponsor.types';
import { RetryButton } from '@/components/data/retry-button';
import { SectionError } from '@/components/data/section-error';
import { MagicCard } from '@/components/magicui/magic-card';
import { Badge } from '@/components/ui/badge';
import { CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/** Shown in the sponsors block when GitHub could not be reached in time. */
const SPONSORS_ERROR_TITLE = "Couldn't load sponsors";

const CURRENT_SPONSORS_HEADING_ID = 'current-sponsors-heading';

/** The current sponsors grid, shared with its skeleton so the skeleton takes its place exactly. */
const CURRENT_SPONSORS_GRID_CLASS = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4';

/** Two rows of the three-column sponsors grid. */
const SKELETON_ROW_COUNT = 6;

/**
 * A past sponsor's avatar is 64px (h-16 w-16) and its link scales it to 110% on hover, so it is
 * drawn at up to 70.4px: 72px picks a file at least that wide (96w at 1x) instead of 64w.
 */
const PAST_AVATAR_SIZES = '72px';

/**
 * A current sponsor's avatar is 48px (h-12 w-12) and its card's link scales it to 102% on hover,
 * so it is drawn at up to 48.96px: 49px picks a file at least that wide (64w at 1x) instead of 48w.
 */
const CURRENT_AVATAR_SIZES = '49px';

/**
 * GitHub can hand back a sponsorship whose account is gone (sl-09). Such an entry has no login to
 * link to or key on, so it is left out instead of breaking the list. getGitHubSponsors already
 * drops these; this keeps the view safe on its own.
 */
const isListable = (sponsor: SponsorEntry | null | undefined): sponsor is SponsorEntry =>
  typeof sponsor?.login === 'string' && sponsor.login.length > 0;

/** Splits the listable sponsors into active (current) and inactive (past) ones. */
function groupSponsors(sponsors: readonly SponsorEntry[]): SponsorGroups {
  const listable = sponsors.filter(isListable);
  return {
    current: listable.filter((sponsor) => sponsor.isActive),
    past: listable.filter((sponsor) => !sponsor.isActive),
  };
}

/** One person can sponsor more than once, so the login alone is not a unique key. */
const sponsorKey = (sponsor: SponsorEntry): string => `${sponsor.login}:${sponsor.createdAt}`;

const displayName = (sponsor: SponsorEntry): string => sponsor.name || sponsor.login;

function CurrentSponsorCard({ sponsor }: { sponsor: SponsorEntry }): ReactElement {
  return (
    <a
      href={sponsor.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block transition-transform duration-300 motion-safe:hover:scale-[1.02]"
    >
      <MagicCard className="border-border group hover:border-primary/50 transition-all duration-300 h-full">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 shrink-0 rounded-full ring-2 ring-border group-hover:ring-primary/50 transition-all overflow-hidden">
              <Image
                src={sponsor.avatarUrl}
                alt={`${displayName(sponsor)}'s avatar`}
                fill
                className="object-cover"
                sizes={CURRENT_AVATAR_SIZES}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                {displayName(sponsor)}
              </p>
              <p className="text-sm text-muted-foreground truncate">@{sponsor.login}</p>
              {sponsor.tier && (
                <div className="flex items-center gap-1.5 mt-1">
                  <Heart className="h-3 w-3 text-primary" />
                  <span className="text-xs text-primary font-medium">
                    ${sponsor.tier.monthlyPriceInDollars}/mo
                  </span>
                </div>
              )}
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
          </div>
        </CardContent>
      </MagicCard>
    </a>
  );
}

function CurrentSponsorsList({
  current,
  totalMonthlyIncome,
}: {
  current: readonly SponsorEntry[];
  totalMonthlyIncome: number;
}): ReactElement {
  return (
    <div className="space-y-6">
      {totalMonthlyIncome > 0 && (
        <div className="flex items-center justify-center">
          {/* hover:border-primary/20 keeps MagicCard's hover:border-hairline-strong from turning
              this card's brand border grey on hover; the card is not a link. */}
          <MagicCard className="bg-primary/5 border-primary/20 hover:border-primary/20">
            <CardContent className="p-6 text-center">
              <p className="text-sm text-muted-foreground mb-2">Monthly Support</p>
              <p className="text-3xl font-bold text-primary">${totalMonthlyIncome}</p>
            </CardContent>
          </MagicCard>
        </div>
      )}

      <div className={CURRENT_SPONSORS_GRID_CLASS}>
        {current.map((sponsor) => (
          <CurrentSponsorCard key={sponsorKey(sponsor)} sponsor={sponsor} />
        ))}
      </div>
    </div>
  );
}

/** Nobody has ever sponsored: the only state that invites a first sponsor (sl-07). */
function FirstSponsorInvite(): ReactElement {
  return (
    <div className="text-center py-16 space-y-4">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted/50">
        <Heart className="h-10 w-10 text-muted-foreground" />
      </div>
      <div>
        <p className="text-foreground font-medium mb-2">Be the first sponsor!</p>
        <p className="text-sm text-muted-foreground">Your support would mean the world</p>
      </div>
    </div>
  );
}

/** No active sponsorship right now, but past sponsors are thanked below. */
function NoCurrentSponsors(): ReactElement {
  return (
    <div className="text-center py-12 space-y-4">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted/50">
        <Heart className="h-8 w-8 text-muted-foreground" />
      </div>
      <div>
        <p className="text-foreground font-medium mb-2">No active sponsors right now</p>
        <p className="text-sm text-muted-foreground">
          Thank you to everyone below who has supported this work
        </p>
      </div>
    </div>
  );
}

function CurrentSponsorsBody({
  sponsors,
  groups,
}: {
  sponsors: GitHubSponsorsData | null;
  groups: SponsorGroups;
}): ReactElement {
  if (sponsors === null) {
    return <SectionError title={SPONSORS_ERROR_TITLE} action={<RetryButton />} />;
  }
  if (groups.current.length > 0) {
    return (
      <CurrentSponsorsList
        current={groups.current}
        totalMonthlyIncome={sponsors.totalMonthlyIncome}
      />
    );
  }
  return groups.past.length > 0 ? <NoCurrentSponsors /> : <FirstSponsorInvite />;
}

function CurrentSponsorsSection({
  sponsors,
  groups,
}: {
  sponsors: GitHubSponsorsData | null;
  groups: SponsorGroups;
}): ReactElement {
  const count = groups.current.length;
  return (
    <section aria-labelledby={CURRENT_SPONSORS_HEADING_ID}>
      <MagicCard className="border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            {/* CardTitle's classes on a real heading, so the section has a place in the outline. */}
            <h2
              id={CURRENT_SPONSORS_HEADING_ID}
              className="font-semibold leading-none tracking-tight"
            >
              Current Sponsors
            </h2>
            {count > 0 && (
              <Badge
                variant="outline"
                className="bg-primary/10 text-primary border-primary/30 px-4 py-1.5"
              >
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                {count} {count === 1 ? 'Sponsor' : 'Sponsors'}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <CurrentSponsorsBody sponsors={sponsors} groups={groups} />
        </CardContent>
      </MagicCard>
    </section>
  );
}

function PastSponsorAvatar({ sponsor }: { sponsor: SponsorEntry }): ReactElement {
  return (
    <a
      href={sponsor.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block transition-transform duration-300 motion-safe:hover:scale-110"
    >
      <div className="flex flex-col items-center gap-2">
        <div className="relative h-16 w-16 rounded-full overflow-hidden ring-2 ring-border/50">
          <Image
            src={sponsor.avatarUrl}
            alt={`${displayName(sponsor)}'s avatar`}
            fill
            className="object-cover grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300"
            sizes={PAST_AVATAR_SIZES}
          />
        </div>
        <p className="text-xs text-muted-foreground group-hover:text-foreground transition-colors text-center truncate w-full">
          {displayName(sponsor)}
        </p>
      </div>
    </a>
  );
}

function PastSponsorsSection({ past }: { past: readonly SponsorEntry[] }): ReactElement {
  return (
    <section>
      <h2 className="text-2xl font-semibold text-foreground mb-6">Past Sponsors</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Grateful for the support from these wonderful people
      </p>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
        {past.map((sponsor) => (
          <PastSponsorAvatar key={sponsorKey(sponsor)} sponsor={sponsor} />
        ))}
      </div>
    </section>
  );
}

/**
 * The current sponsors card, then the past sponsors when there are any. `sponsors` is null when
 * GitHub failed or ran past the deadline: the card then shows SectionError with a retry, and
 * never the error's own text (sl-10).
 */
export function SponsorLists({ sponsors }: SponsorListsProps): ReactElement {
  const groups = groupSponsors(sponsors?.sponsors ?? []);
  return (
    <>
      <CurrentSponsorsSection sponsors={sponsors} groups={groups} />
      {groups.past.length > 0 && <PastSponsorsSection past={groups.past} />}
    </>
  );
}

function SponsorRowSkeleton(): ReactElement {
  return (
    <MagicCard className="border-border">
      <CardContent className="p-4 flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </CardContent>
    </MagicCard>
  );
}

const SKELETON_ROW_KEYS = Array.from(
  { length: SKELETON_ROW_COUNT },
  (_, index) => `sponsor-${index}`,
);

/** The current sponsors card's placeholder: its title bar and two rows of sponsor cards. */
export function SponsorListsSkeleton(): ReactElement {
  return (
    <output className="block" aria-label="Loading sponsors">
      <div aria-hidden="true">
        <MagicCard className="border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-36" />
            </div>
          </CardHeader>
          <CardContent>
            <div className={CURRENT_SPONSORS_GRID_CLASS}>
              {SKELETON_ROW_KEYS.map((key) => (
                <SponsorRowSkeleton key={key} />
              ))}
            </div>
          </CardContent>
        </MagicCard>
      </div>
    </output>
  );
}
