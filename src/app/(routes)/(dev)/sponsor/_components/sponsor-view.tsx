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
 * @file /sponsor as "Ways first" (picked 2026-11-10): a PageShell whose first link is "Sponsor on
 * GitHub", then the ways to sponsor as plain rows, then the thank-you row. On a wide page the
 * ways take the larger column and the thanks sit beside them; on a phone they stack, ways first,
 * so they are above the fold. A server component with no client code: the page awaits its data
 * first, so everything is in the server HTML, readable with JS off and by crawlers.
 */

import { Mail } from 'lucide-react';
import type { ReactElement } from 'react';
import { SiGithubsponsors } from 'react-icons/si';

import { NEW_TAB_LABEL, NewTabArrow, PageShell, SrOnlyWords } from '@/components/console';
import { Button } from '@/components/ui/button';
import { profile } from '@/constants/profile';
import type { GitHubSponsorsData } from '@/lib/api-integrations/github-sponsors';
import type { SponsorViewOptions } from '../_lib/options';
import {
  anchorAttrs,
  type LinkTarget,
  linkTargetOf,
  PRIMARY_WAY_ID,
  SPONSOR_WAYS,
  shapeWays,
} from '../_lib/ways';
import { BenefitsList } from './benefits-list';
import { ThanksRow } from './thanks-row';
import { WaysList } from './ways-list';

/** The route itself: where the thank-you row's "Try again" reloads. */
const SPONSOR_PATH = '/sponsor';

/** The nav's label for the page, so the h1 and the nav agree. */
const PAGE_TITLE = 'Sponsor';
const PAGE_DESCRIPTION =
  'Your support helps me build open-source projects, make educational content and keep them running.';

const WAYS = shapeWays(SPONSOR_WAYS);
const PRIMARY_WAY = WAYS.find((way) => way.id === PRIMARY_WAY_ID);
const EMAIL = linkTargetOf(profile.emailHref);

/** The two-column split from lg: the ways get three parts, the thanks two. */
const BODY_CLASS = 'grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start lg:gap-10';

/**
 * The header's buttons may wrap their words: with text enlarged on a phone, "Sponsor on GitHub"
 * on one line was wider than the page and widened the whole header past the screen, cutting the
 * title and the description. On a page under ten lines of its text wide they also grow to fit
 * their lines and drop their leading icon (decorative; the words say it), so the longest word
 * and the arrow fit the column; otherwise they keep the button's fixed 36px (their words fit, and
 * the new-tab arrow's line box would make an auto height 38px).
 */
const ACTION_CLASS =
  'max-w-full whitespace-normal @max-[10lh]/page:h-auto @max-[10lh]/page:min-h-9 @max-[10lh]/page:[&>svg:first-child]:hidden';

/** The new-tab arrow and its spoken words, for a link that opens a new tab; nothing otherwise. */
function NewTabMark({ target }: { readonly target: LinkTarget }): ReactElement | null {
  if (!target.newTab) return null;
  return (
    <>
      <NewTabArrow />
      <SrOnlyWords>{NEW_TAB_LABEL}</SrOnlyWords>
    </>
  );
}

/**
 * The header's actions: "Sponsor on GitHub" first (the page's first link), then Email, which
 * stays in this tab like any mailto:. Either is left out if its link is unusable.
 */
function SponsorActions(): ReactElement {
  return (
    <>
      {PRIMARY_WAY ? (
        <Button asChild className={ACTION_CLASS}>
          <a {...anchorAttrs(PRIMARY_WAY)}>
            <SiGithubsponsors aria-hidden="true" />
            Sponsor on GitHub
            <NewTabMark target={PRIMARY_WAY} />
          </a>
        </Button>
      ) : null}
      {EMAIL ? (
        <Button asChild variant="outline" className={ACTION_CLASS}>
          <a {...anchorAttrs(EMAIL)}>
            <Mail aria-hidden="true" />
            Email
          </a>
        </Button>
      ) : null}
    </>
  );
}

export interface SponsorViewProps {
  /** What GitHub returned, or null when it failed or missed the deadline. */
  readonly sponsors: GitHubSponsorsData | null;
  /** The owner's open decision (the benefits copy); the route passes DEFAULT_SPONSOR_OPTIONS. */
  readonly options: SponsorViewOptions;
  /** Pads the sides with the page gutter (on by default). Off inside the routes lab's own shell. */
  readonly gutter?: boolean;
}

/** The whole /sponsor page. */
export function SponsorView({ sponsors, options, gutter = true }: SponsorViewProps): ReactElement {
  return (
    <PageShell
      title={PAGE_TITLE}
      description={PAGE_DESCRIPTION}
      actions={<SponsorActions />}
      gutter={gutter}
    >
      <div className={BODY_CLASS}>
        <div className="flex min-w-0 flex-col gap-8">
          <WaysList ways={WAYS} />
          {options.benefits === 'keep' ? <BenefitsList /> : null}
        </div>
        <ThanksRow sponsors={sponsors} retryHref={SPONSOR_PATH} />
      </div>
    </PageShell>
  );
}
