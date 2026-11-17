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

import { createHash } from 'node:crypto';
import { type LinkRecord, readRecord } from './state';
import { normalizeLinkUrl } from './url';

const HEALTH_DOCUMENT_TYPE = 'linkHealth';
const HEALTH_DOCUMENT_VERSION = 1;
export const HEALTH_DOCUMENT_QUERY = `*[_type == "linkHealth" && _id in $ids]{
  _id, _rev, _type, schemaVersion, url, kind, status, httpStatus, checkedAt, nextCheckAt, missingSince
}`;

export interface HealthDocument {
  _id: string;
  _type: typeof HEALTH_DOCUMENT_TYPE;
  schemaVersion: typeof HEALTH_DOCUMENT_VERSION;
  url: string;
  kind: LinkRecord['kind'];
  status: LinkRecord['status'];
  checkedAt: string;
  nextCheckAt: string;
  missingSince?: string;
  httpStatus?: number;
}

export interface StoredHealth {
  url: string;
  revision: string;
  record: LinkRecord;
}

/** The writer can only create health-cache IDs, never portfolio-content document IDs. */
export function healthDocumentId(value: string): string {
  const canonical = normalizeLinkUrl(value);
  if (!canonical) throw new Error('Invalid link-health URL');
  return `linkHealth.${createHash('sha256').update(canonical).digest('hex')}`;
}

export function makeHealthDocument(value: string, record: LinkRecord): HealthDocument {
  const url = normalizeLinkUrl(value);
  if (!url || !readRecord(record)) throw new Error('Invalid link-health observation');
  return {
    _id: healthDocumentId(url),
    _type: HEALTH_DOCUMENT_TYPE,
    schemaVersion: HEALTH_DOCUMENT_VERSION,
    url,
    kind: record.kind,
    status: record.status,
    checkedAt: new Date(record.checkedAt).toISOString(),
    nextCheckAt: new Date(record.nextCheckAt).toISOString(),
    ...(record.missingSince === undefined
      ? {}
      : { missingSince: new Date(record.missingSince).toISOString() }),
    ...(record.httpStatus === undefined ? {} : { httpStatus: record.httpStatus }),
  };
}

function isoTime(value: unknown): number | undefined {
  if (typeof value !== 'string' || value.length > 32) return;
  const time = Date.parse(value);
  if (Number.isFinite(time) && time >= 0 && new Date(time).toISOString() === value) return time;
  return;
}

/** Identity/revision validation is separate so an invalid observation can be safely repaired. */
export function healthDocumentRevision(value: unknown, url: string): string | undefined {
  if (!value || typeof value !== 'object') return;
  const doc = value as Record<string, unknown>;
  if (
    doc._type !== HEALTH_DOCUMENT_TYPE ||
    doc._id !== healthDocumentId(url) ||
    doc.url !== url ||
    typeof doc._rev !== 'string' ||
    !/^[\w-]{1,128}$/u.test(doc._rev)
  )
    return;
  return doc._rev;
}

/** Validate every stored field rather than trusting a Studio document or JSON type cast. */
export function readHealthDocument(value: unknown, now: number): StoredHealth | undefined {
  if (!value || typeof value !== 'object') return;
  const doc = value as Record<string, unknown>;
  const url = normalizeLinkUrl(doc.url);
  if (!url || url !== doc.url || doc.schemaVersion !== HEALTH_DOCUMENT_VERSION) return;
  const revision = healthDocumentRevision(doc, url);
  if (!revision) return;
  const checkedAt = isoTime(doc.checkedAt);
  const nextCheckAt = isoTime(doc.nextCheckAt);
  const missingSince = doc.missingSince == null ? undefined : isoTime(doc.missingSince);
  if (
    checkedAt === undefined ||
    checkedAt > now ||
    nextCheckAt === undefined ||
    (doc.missingSince != null && missingSince === undefined)
  )
    return;
  const record = readRecord({
    kind: doc.kind,
    status: doc.status,
    checkedAt,
    nextCheckAt,
    ...(missingSince === undefined ? {} : { missingSince }),
    ...(doc.httpStatus == null ? {} : { httpStatus: doc.httpStatus }),
  });
  return record ? { url, revision, record } : undefined;
}
