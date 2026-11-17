import 'server-only';
import { type LinkRecord, nextRecord, publicEntry, readRecord } from './state';
import type { LinkHealthResponse, LinkHealthScope, LinkObservation } from './types';

export interface LinkHealthStore {
  read(scope: LinkHealthScope): Promise<unknown>;
  /** A global, 30-second lease; retained as a cooldown after the bounded batch finishes. */
  acquire(): Promise<string | null>;
  /** Save only while this token still owns the lease; a paused worker must not overwrite recovery. */
  write(scope: LinkHealthScope, records: Record<string, LinkRecord>, lease: string): Promise<void>;
}

interface Dependencies {
  store: LinkHealthStore | null;
  catalog(scope: LinkHealthScope): Promise<string[]>;
  probe(url: string): Promise<LinkObservation>;
  now?: () => number;
  report?: (error: unknown) => void;
}

function recordsFor(raw: unknown, urls: readonly string[]): Record<string, LinkRecord> {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const records: Record<string, LinkRecord> = {};
  for (const url of urls) {
    const record = readRecord(source[url]);
    if (record) records[url] = record;
  }
  return records;
}

/** Reads never probe. Refreshes accept a fixed content scope, never caller-supplied URLs. */
export function createLinkHealthService({
  store,
  catalog,
  probe,
  now = Date.now,
  report = () => undefined,
}: Dependencies) {
  const urlsFor = async (scope: LinkHealthScope) =>
    [...new Set(await catalog(scope))].slice(0, 500);
  return {
    async read(scope: LinkHealthScope): Promise<LinkHealthResponse> {
      if (!store) return { links: {} };
      try {
        const urls = await urlsFor(scope);
        const records = recordsFor(await store.read(scope), urls);
        const links: LinkHealthResponse['links'] = {};
        const time = now();
        for (const [url, record] of Object.entries(records)) {
          const entry = publicEntry(record, time);
          if (entry) links[url] = entry;
        }
        return { links };
      } catch (error) {
        report(error);
        return { links: {} };
      }
    },

    async refresh(scope: LinkHealthScope): Promise<void> {
      if (!store) return;
      try {
        const urls = await urlsFor(scope);
        let records = recordsFor(await store.read(scope), urls);
        const due = (url: string) => !records[url] || records[url].nextCheckAt <= now();
        if (!urls.some(due)) return;
        const deadline = now() + 24_000;
        const lease = await store.acquire();
        if (!lease) return;
        // Another worker may have saved results between our first read and lease acquisition.
        records = recordsFor(await store.read(scope), urls);
        const selected = urls
          .filter(due)
          .sort((a, b) => {
            // Confirm a suspected missing page promptly, then move on to untouched/old URLs.
            const priority = (url: string) =>
              records[url]?.kind === 'missing' && records[url]?.status === 'unknown' ? 0 : 1;
            return (
              priority(a) - priority(b) ||
              (records[a]?.checkedAt ?? 0) - (records[b]?.checkedAt ?? 0)
            );
          })
          .slice(0, 8);
        if (selected.length === 0) return;
        // Each probe has a five-second total deadline. Four pairs plus storage fit the lease.
        for (let index = 0; index < selected.length; index += 2) {
          if (now() >= deadline) break;
          await Promise.all(
            selected.slice(index, index + 2).map(async (url) => {
              let observation: LinkObservation;
              try {
                observation = await probe(url);
              } catch (error) {
                report(error);
                observation = { kind: 'unknown' };
              }
              records[url] = nextRecord(records[url], observation, now());
            }),
          );
        }
        await store.write(scope, records, lease);
      } catch (error) {
        // Especially important for a failed/ambiguous lease acquisition: never fail open.
        report(error);
      }
    },
  };
}
