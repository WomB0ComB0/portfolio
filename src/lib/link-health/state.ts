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

import type { LinkHealthEntry, LinkHealthStatus, LinkObservation } from './types';

const MINUTE = 60_000;
export const WARNING_MAX_AGE = 24 * 60 * MINUTE;
export const CONFIRM_AFTER = 2 * MINUTE;

export interface LinkRecord {
  kind: LinkObservation['kind'];
  status: LinkHealthStatus;
  checkedAt: number;
  nextCheckAt: number;
  missingSince?: number;
  httpStatus?: number;
}

/** Reachability is an observation, never a claim that an application's features work. */
export function nextRecord(
  previous: LinkRecord | undefined,
  observation: LinkObservation,
  now: number,
): LinkRecord {
  const httpStatus =
    Number.isInteger(observation.httpStatus) &&
    (observation.httpStatus ?? 0) >= 100 &&
    (observation.httpStatus ?? 0) <= 599
      ? observation.httpStatus
      : undefined;
  const kind =
    observation.kind === 'missing' && httpStatus !== 404 && httpStatus !== 410
      ? 'unknown'
      : observation.kind;
  const prior = readRecord(previous);
  if (kind === 'missing') {
    const consecutive =
      prior?.kind === 'missing' &&
      prior.checkedAt <= now &&
      now - prior.checkedAt < WARNING_MAX_AGE;
    const missingSince = consecutive ? (prior.missingSince ?? now) : now;
    const confirmed = consecutive && now - missingSince >= CONFIRM_AFTER;
    return {
      kind,
      status: confirmed ? 'unavailable' : 'unknown',
      checkedAt: now,
      nextCheckAt: now + (confirmed ? 60 * MINUTE : CONFIRM_AFTER),
      missingSince,
      httpStatus,
    };
  }
  return {
    kind,
    status: kind === 'reachable' ? 'reachable' : 'unknown',
    checkedAt: now,
    nextCheckAt: now + (kind === 'temporary' ? 15 : 360) * MINUTE,
    ...(httpStatus === undefined ? {} : { httpStatus }),
  };
}

/** Discard malformed persisted observations; stored JSON is not a type assertion. */
export function readRecord(value: unknown): LinkRecord | undefined {
  if (!value || typeof value !== 'object') return;
  const record = value as Partial<LinkRecord>;
  const time = (value: unknown): value is number =>
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= 8_640_000_000_000_000;
  if (!time(record.checkedAt) || !time(record.nextCheckAt)) return;
  if (
    record.nextCheckAt < record.checkedAt ||
    record.nextCheckAt - record.checkedAt > WARNING_MAX_AGE
  )
    return;
  if (record.kind === 'missing') {
    if (record.httpStatus !== 404 && record.httpStatus !== 410) return;
    if (record.status !== 'unknown' && record.status !== 'unavailable') return;
    if (!time(record.missingSince) || record.missingSince > record.checkedAt) return;
    if (record.status === 'unavailable' && record.checkedAt - record.missingSince < CONFIRM_AFTER)
      return;
  } else if (
    !['reachable', 'temporary', 'unknown'].includes(record.kind ?? '') ||
    record.status !== (record.kind === 'reachable' ? 'reachable' : 'unknown') ||
    record.missingSince !== undefined
  ) {
    return;
  }
  if (
    record.httpStatus !== undefined &&
    (!Number.isInteger(record.httpStatus) || record.httpStatus < 100 || record.httpStatus > 599)
  )
    return;
  return record as LinkRecord;
}

export function publicEntry(record: LinkRecord, now: number): LinkHealthEntry | undefined {
  if (!readRecord(record) || record.status !== 'unavailable') return;
  if (record.checkedAt > now || now - record.checkedAt >= WARNING_MAX_AGE) return;
  return { status: record.status, checkedAt: new Date(record.checkedAt).toISOString() };
}
