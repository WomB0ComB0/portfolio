import 'server-only';

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
 * @file The projects, loaded for the experience pages' technology links (role-tech.ts). The
 * links are an extra, so they never hold or fail the page:
 * - The load is the shared, cached loadProjects(), given a short deadline: the roles beside it
 *   answer from their own cache, and a slow projects read must not keep them waiting.
 * - Past the deadline, or on a failure, the last list the process had is used (however old: it
 *   only links technologies); the read goes on and fills the cache for the next request.
 * - With no list at all the technologies are plain text, and that is reported as a warning.
 */

import type { Project } from '@/hooks/sanity/schemas';
import { withDeadline } from '@/lib/async/deadline';
import { reportApiFailure } from '@/lib/observability/report';
import { loadProjects, peekProjects } from '@/lib/sanity/loaders';
import { logger } from '@/utils';

/** Groups these fallbacks in Sentry (one event per cooldown window). */
const REPORT_CONTEXT = 'load projects for experience technology links';
/** How long the pages wait for the projects before linking from the last list, or not at all. */
export const TECH_PROJECTS_DEADLINE_MS = 1500;

/**
 * Every project, or null when none could be had in time; never rejects. Past the deadline or on
 * a failure, the last list loaded in this process stands in.
 */
export async function loadTechProjects(): Promise<readonly Project[] | null> {
  try {
    return await withDeadline(loadProjects(), TECH_PROJECTS_DEADLINE_MS, REPORT_CONTEXT);
  } catch (error) {
    const last = peekProjects()?.data;
    if (last) return last;
    logger.warn('Experience technology links fell back to plain text', { error });
    reportApiFailure(error, { context: REPORT_CONTEXT, level: 'warning' });
    return null;
  }
}
