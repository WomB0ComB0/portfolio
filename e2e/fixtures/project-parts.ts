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
 * @file What the browser checks of a project's parts ("How it fits together") read from the live
 * list (GET /api/v1/sanity/projects, which serves each project's raw `systemParts`): which parts
 * the page shows a row for, and which of those rows is a private repository. The reading is the
 * e2e's own, written from what Studio stores, so a check compares the page with the data rather
 * than with the view model that drew it. Only the threshold is shared with the site
 * (src/sanity/project-part-rules.ts), so a project the page shows as one repository is never
 * picked. Used by e2e/journeys/project-page.spec.ts and projects-index.spec.ts.
 */

import { type APIRequestContext, expect } from '@playwright/test';

import { MIN_PARTS } from '@/sanity/project-part-rules';
import { getTargetUrl } from './base';

/** One part as the API serves it: Studio's fields, any of which old data may lack. */
export interface ApiPart {
  readonly _key?: unknown;
  readonly name?: unknown;
  readonly repoUrl?: unknown;
  readonly projectId?: unknown;
}

/** What these checks read of a project. */
export interface ApiPartsProject {
  readonly _id: string;
  readonly title: string;
  readonly systemParts?: readonly ApiPart[] | null;
}

/** Text with something in it besides spaces. */
export const filled = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '';

/** The words as the page shows them: whitespace collapsed, trimmed. */
export const oneLine = (text: string): string => text.replace(/\s+/g, ' ').trim();

/**
 * The parts the page shows a row for, in Studio order: each with a key and a name, the first of
 * each key kept. None below MIN_PARTS, where the page shows no section and the card no count.
 */
export function shownParts(project: Pick<ApiPartsProject, 'systemParts'>): readonly ApiPart[] {
  const all: readonly ApiPart[] = Array.isArray(project.systemParts) ? project.systemParts : [];
  const keys = new Set<string>();
  const shown = all.filter((part) => {
    if (!filled(part?._key) || !filled(part?.name) || keys.has(part._key.trim())) return false;
    keys.add(part._key.trim());
    return true;
  });
  return shown.length >= MIN_PARTS ? shown : [];
}

/** A project the page shows as several repositories. */
export const hasParts = (project: Pick<ApiPartsProject, 'systemParts'>): boolean =>
  shownParts(project).length > 0;

/** A row with no address and no page link: the page says "Private repository" and links nothing. */
export const isPrivatePart = (part: ApiPart): boolean =>
  !filled(part.repoUrl) && !filled(part.projectId);

/** The selector for one part's row on the project page. */
export const partRow = (part: ApiPart): string =>
  `[data-case-part-key=${JSON.stringify(String(part._key).trim())}]`;

async function readList(request: APIRequestContext): Promise<readonly ApiPartsProject[]> {
  const response = await request.get(`${getTargetUrl()}/api/v1/sanity/projects`);
  expect(response.ok(), `GET /api/v1/sanity/projects answered ${response.status()}`).toBe(true);
  const body = (await response.json()) as { data?: ApiPartsProject[] } | ApiPartsProject[];
  return Array.isArray(body) ? body : (body.data ?? []);
}

let listed: Promise<readonly ApiPartsProject[]> | undefined;

/**
 * Every project, as the live list serves it (GET only), read once per worker: the list does not
 * change during a run, and /api/v1 allows each address 100 requests a minute, which the pages'
 * own link-health requests already share. A failed read is not kept, so the next check tries
 * again. `T` names the fields a spec reads; the projects carry every field the API serves.
 */
export function listPartsProjects<T extends ApiPartsProject = ApiPartsProject>(
  request: APIRequestContext,
): Promise<readonly T[]> {
  listed ??= readList(request).catch((error: unknown) => {
    listed = undefined;
    throw error;
  });
  return listed as Promise<readonly T[]>;
}
