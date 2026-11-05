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
 * @file The /sponsor sponsors block as an async server component. It is the only part of the page
 * that waits on GitHub, so the page renders it behind its own Suspense boundary and the static
 * sections stream at once.
 */

import 'server-only';

import type { ReactElement } from 'react';

import { SponsorLists } from '@/app/(routes)/(dev)/sponsor/_components/sponsor-lists';
import { type GitHubSponsorsData, getGitHubSponsors } from '@/lib/api-integrations/github-sponsors';
import { DeadlineError, withDeadline } from '@/lib/async/deadline';
import { reportApiFailure } from '@/lib/observability/report';

/**
 * How long the block waits for GitHub before it shows its error. getGitHubSponsors retries a
 * timed-out call twice, so a hanging GitHub would otherwise hold the stream for about 33 s. The
 * fetch is not cancelled: a late answer still fills the shared cache for the next visit.
 */
export const SPONSORS_DEADLINE_MS = 3_000;

/** Tags and groups the Sentry issue when the page cannot load its sponsors. */
const SPONSORS_REPORT_CONTEXT = 'load sponsors for page';

/**
 * The sponsors, or null when GitHub failed with no list cached, or missed the deadline. Never
 * throws, so only the sponsors block shows an error. getGitHubSponsors reports a failed GitHub
 * load itself (reporting the same error here again is a no-op); a missed deadline is reported
 * here, as a warning, since the fetch keeps running and fills the cache for the next visit.
 */
async function loadSponsors(): Promise<GitHubSponsorsData | null> {
  try {
    return await withDeadline(getGitHubSponsors(), SPONSORS_DEADLINE_MS, 'github sponsors');
  } catch (error) {
    reportApiFailure(error, {
      context: SPONSORS_REPORT_CONTEXT,
      level: error instanceof DeadlineError ? 'warning' : 'error',
    });
    return null;
  }
}

/**
 * The current and past sponsors from GitHub Sponsors, in the server HTML.
 *
 * @example
 * <SectionBoundary label="sponsors">
 *   <Suspense fallback={<SponsorListsSkeleton />}>
 *     <Sponsors />
 *   </Suspense>
 * </SectionBoundary>
 */
export async function Sponsors(): Promise<ReactElement> {
  return <SponsorLists sponsors={await loadSponsors()} />;
}
