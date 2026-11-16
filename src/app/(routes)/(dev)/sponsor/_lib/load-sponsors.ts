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
 * @file Loads /sponsor's sponsors on the server, bounded by a deadline. getGitHubSponsors serves
 * its cache stale while it refreshes, so after the first load this answers at once; only a cold
 * process waits on GitHub, and never past SPONSORS_DEADLINE_MS. A failure is reported and turned
 * into null, which the page shows as one worded line while the ways render as usual.
 */

import 'server-only';

import { type GitHubSponsorsData, getGitHubSponsors } from '@/lib/api-integrations/github-sponsors';
import { DeadlineError, withDeadline } from '@/lib/async/deadline';
import { reportApiFailure } from '@/lib/observability/report';

/**
 * How long the page waits for GitHub. getGitHubSponsors retries a timed-out call twice, so a
 * hanging GitHub would otherwise hold the page for about 33 s. The fetch is not cancelled: a late
 * answer still fills the shared cache for the next visit.
 */
export const SPONSORS_DEADLINE_MS = 3_000;

/** Tags and groups the Sentry issue when the page cannot load its sponsors. */
const SPONSORS_REPORT_CONTEXT = 'load sponsors for page';

/**
 * The sponsors, or null when GitHub failed with no list cached, or missed the deadline. Never
 * throws. getGitHubSponsors reports a failed GitHub load itself (reporting the same error here
 * again is a no-op); a missed deadline is reported here, as a warning, since the fetch keeps
 * running and fills the cache for the next visit.
 */
export async function loadSponsors(): Promise<GitHubSponsorsData | null> {
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
