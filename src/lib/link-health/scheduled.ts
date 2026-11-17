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

import {
  type HealthDocument,
  healthDocumentId,
  healthDocumentRevision,
  makeHealthDocument,
  readHealthDocument,
} from './documents';
import { canWarnForLink } from './public-warning';
import { type LinkRecord, nextRecord } from './state';
import { LINK_HEALTH_SCOPES, type LinkHealthScope, type LinkObservation } from './types';
import { normalizeLinkUrl } from './url';

const MAX_CHECKS = 100;
const RUN_BUDGET_MS = 5 * 60_000;
type Stage = 'catalog' | 'read' | 'probe' | 'write' | 'deadline';

/** Error messages never carry SDK configuration, headers, tokens, URLs or response bodies. */
export class ScheduledCheckError extends Error {
  constructor(readonly stage: Stage) {
    super(`Scheduled link check failed: ${stage}`);
  }
}

export type HealthMutation =
  | { create: HealthDocument }
  | { patch: { id: string; ifRevisionID: string; set: Record<string, unknown>; unset: string[] } };

export interface ScheduledDependencies {
  catalog(scope: LinkHealthScope): Promise<readonly string[]>;
  readDocuments(ids: readonly string[]): Promise<unknown>;
  probe(url: string): Promise<LinkObservation>;
  /** Implemented with one atomic Sanity transaction, never a per-record write loop. */
  write(mutations: HealthMutation[]): Promise<unknown>;
  now?: () => number;
  monotonic?: () => number;
}

export interface ScheduledReport {
  catalog: number;
  due: number;
  checked: number;
  deferred: number;
  written: number;
  unavailable: number;
  unknown: number;
  reachable: number;
  dryRun: boolean;
}

async function step<T>(stage: Stage, task: () => Promise<T>): Promise<T> {
  try {
    return await task();
  } catch (error) {
    if (error instanceof ScheduledCheckError) throw error;
    throw new ScheduledCheckError(stage);
  }
}

function catalogUrls(scopes: readonly (readonly string[])[]): string[] {
  const urls = new Set<string>();
  for (const scope of scopes) {
    if (!Array.isArray(scope) || scope.length > 500) throw new ScheduledCheckError('catalog');
    for (const value of scope) {
      const url = normalizeLinkUrl(value);
      if (!url || url !== value) throw new ScheduledCheckError('catalog');
      urls.add(url);
    }
  }
  return [...urls];
}

/** Fixed catalogs, due records only, two probes at once, one revision-guarded transaction. */
export async function runScheduledChecks(
  deps: ScheduledDependencies,
  { dryRun = false }: { dryRun?: boolean } = {},
): Promise<ScheduledReport> {
  const now = deps.now ?? Date.now;
  const monotonic = deps.monotonic ?? (() => performance.now());
  const deadline = monotonic() + RUN_BUDGET_MS;
  const assertActive = (): void => {
    if (monotonic() >= deadline) throw new ScheduledCheckError('deadline');
  };
  const urls = catalogUrls(
    await step('catalog', () =>
      Promise.all(LINK_HEALTH_SCOPES.map((scope) => deps.catalog(scope))),
    ),
  );
  assertActive();
  const byId = new Map(urls.map((url) => [healthDocumentId(url), url]));
  const raw = urls.length ? await step('read', () => deps.readDocuments([...byId.keys()])) : [];
  if (!Array.isArray(raw) || raw.length > urls.length) throw new ScheduledCheckError('read');
  const existing = new Map<string, { revision: string; record: LinkRecord }>();
  const time = now();
  for (const value of raw) {
    if (!value || typeof value !== 'object') throw new ScheduledCheckError('read');
    const url = byId.get((value as Record<string, unknown>)._id as string);
    if (!url || !healthDocumentRevision(value, url)) throw new ScheduledCheckError('read');
    const parsed = readHealthDocument(value, time);
    if (!parsed || existing.has(url)) throw new ScheduledCheckError('read');
    existing.set(url, parsed);
  }
  const due = urls
    .filter((url) => !existing.has(url) || (existing.get(url)?.record.nextCheckAt ?? 0) <= time)
    .sort(
      (a, b) =>
        (existing.get(a)?.record.nextCheckAt ?? 0) - (existing.get(b)?.record.nextCheckAt ?? 0) ||
        a.localeCompare(b),
    );
  const selected = due.slice(0, MAX_CHECKS);
  const documents: HealthDocument[] = [];
  let cursor = 0;
  let failed = false;
  const worker = async (): Promise<void> => {
    try {
      while (!failed) {
        const url = selected[cursor++];
        if (!url) return;
        assertActive();
        let observation = await step('probe', () => deps.probe(url));
        assertActive();
        if (!canWarnForLink(url) && observation.kind === 'missing')
          observation = { kind: 'unknown', httpStatus: observation.httpStatus };
        documents.push(
          makeHealthDocument(url, nextRecord(existing.get(url)?.record, observation, now())),
        );
      }
    } catch (error) {
      failed = true;
      throw error;
    }
  };
  const completed = await Promise.allSettled([worker(), worker()]);
  const rejected = completed.find((result) => result.status === 'rejected');
  if (rejected?.status === 'rejected') throw rejected.reason;
  assertActive();
  const mutations: HealthMutation[] = documents
    .sort((a, b) => a.url.localeCompare(b.url))
    .map((document) => {
      const previous = existing.get(document.url);
      if (!previous) return { create: document };
      const { _id, _type, ...fields } = document;
      return {
        patch: {
          id: _id,
          ifRevisionID: previous.revision,
          set: fields,
          unset: ['missingSince', 'httpStatus'].filter((key) => !Object.hasOwn(fields, key)),
        },
      };
    });
  if (!dryRun && mutations.length) await step('write', () => deps.write(mutations));
  return {
    catalog: urls.length,
    due: due.length,
    checked: documents.length,
    deferred: due.length - documents.length,
    written: dryRun ? 0 : documents.length,
    unavailable: documents.filter((doc) => doc.status === 'unavailable').length,
    unknown: documents.filter((doc) => doc.status === 'unknown').length,
    reachable: documents.filter((doc) => doc.status === 'reachable').length,
    dryRun,
  };
}
