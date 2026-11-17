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
}

/** Reachability is an observation, never a claim that an application's features work. */
export function nextRecord(
  previous: LinkRecord | undefined,
  observation: LinkObservation,
  now: number,
): LinkRecord {
  const { kind } = observation;
  if (kind === 'missing') {
    const consecutive =
      previous?.kind === 'missing' &&
      previous.checkedAt <= now &&
      now - previous.checkedAt < WARNING_MAX_AGE;
    const missingSince = consecutive ? (previous.missingSince ?? now) : now;
    const confirmed = consecutive && now - missingSince >= CONFIRM_AFTER;
    return {
      kind,
      status: confirmed ? 'unavailable' : 'unknown',
      checkedAt: now,
      nextCheckAt: now + (confirmed ? 60 * MINUTE : CONFIRM_AFTER),
      missingSince,
    };
  }
  return {
    kind,
    status: kind,
    checkedAt: now,
    nextCheckAt: now + (kind === 'temporary' ? 15 : 360) * MINUTE,
  };
}

/** Discard malformed cache entries; Redis data is not a type assertion. */
export function readRecord(value: unknown): LinkRecord | undefined {
  if (!value || typeof value !== 'object') return;
  const record = value as Partial<LinkRecord>;
  const time = (value: unknown): value is number =>
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
  if (!time(record.checkedAt) || !time(record.nextCheckAt)) return;
  if (
    record.nextCheckAt < record.checkedAt ||
    record.nextCheckAt - record.checkedAt > WARNING_MAX_AGE
  )
    return;
  if (record.kind === 'missing') {
    if (record.status !== 'unknown' && record.status !== 'unavailable') return;
    if (!time(record.missingSince) || record.missingSince > record.checkedAt) return;
    if (record.status === 'unavailable' && record.checkedAt - record.missingSince < CONFIRM_AFTER)
      return;
  } else if (
    !['reachable', 'temporary', 'unknown'].includes(record.kind ?? '') ||
    record.status !== record.kind
  ) {
    return;
  }
  return record as LinkRecord;
}

export function publicEntry(record: LinkRecord, now: number): LinkHealthEntry | undefined {
  if (record.checkedAt > now || now - record.checkedAt >= WARNING_MAX_AGE) return;
  return { status: record.status, checkedAt: new Date(record.checkedAt).toISOString() };
}
