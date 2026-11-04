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
 * @file In-memory stand-in for the subset of the Upstash Redis client the ban store and the API
 * guard use: sorted sets (ZADD, ZSCORE, ZRANGE by rank or BYSCORE with exclusive bounds and
 * LIMIT, ZREM, ZREMRANGEBYSCORE), JSON strings (SET with PXAT, GET, DEL) and pipelines of
 * sorted-set reads. Every command is recorded; `failWith` makes every command reject.
 */

type Bound = number | `(${number}` | '-inf' | '+inf';

interface ZRangeOptions {
  byScore?: boolean;
  offset?: number;
  count?: number;
}

function parseBound(bound: Bound): { value: number; exclusive: boolean } {
  if (bound === '-inf') return { value: Number.NEGATIVE_INFINITY, exclusive: false };
  if (bound === '+inf') return { value: Number.POSITIVE_INFINITY, exclusive: false };
  if (typeof bound === 'string') return { value: Number(bound.slice(1)), exclusive: true };
  return { value: bound, exclusive: false };
}

const above = (score: number, min: Bound): boolean => {
  const { value, exclusive } = parseBound(min);
  return exclusive ? score > value : score >= value;
};

const below = (score: number, max: Bound): boolean => {
  const { value, exclusive } = parseBound(max);
  return exclusive ? score < value : score <= value;
};

export class FakeRedis {
  /** Every command, in call order, as [name, ...args]. */
  readonly calls: unknown[][] = [];
  /** When set, every command rejects with this error. */
  failWith: Error | null = null;
  /** Clock used for PXAT expiry of string keys. */
  now: () => number = () => Date.now();

  private readonly zsets = new Map<string, Map<string, number>>();
  private readonly strings = new Map<string, { value: unknown; pxat?: number }>();

  /** Clears all data, recorded calls and the failure switch. */
  reset(): void {
    this.calls.length = 0;
    this.pipelines = 0;
    this.failWith = null;
    this.zsets.clear();
    this.strings.clear();
  }

  /** Recorded calls of one command. */
  callsTo(name: string): unknown[][] {
    return this.calls.filter(([command]) => command === name);
  }

  /** Members of a sorted set with their scores, for assertions. */
  zsetEntries(key: string): Array<[string, number]> {
    return [...(this.zsets.get(key)?.entries() ?? [])];
  }

  /** Stored value and PXAT of a string key, for assertions. */
  stringEntry(key: string): { value: unknown; pxat?: number } | undefined {
    return this.strings.get(key);
  }

  private async run<T>(name: string, args: unknown[], body: () => T): Promise<T> {
    this.calls.push([name, ...args]);
    if (this.failWith) throw this.failWith;
    return body();
  }

  private zset(key: string): Map<string, number> {
    let set = this.zsets.get(key);
    if (!set) {
      set = new Map();
      this.zsets.set(key, set);
    }
    return set;
  }

  zadd(key: string, entry: { score: number; member: string }): Promise<number> {
    return this.run('zadd', [key, entry], () => {
      const set = this.zset(key);
      const added = set.has(entry.member) ? 0 : 1;
      set.set(entry.member, entry.score);
      return added;
    });
  }

  zscore(key: string, member: string): Promise<number | null> {
    return this.run('zscore', [key, member], () => this.zsets.get(key)?.get(member) ?? null);
  }

  zrange(key: string, min: Bound, max: Bound, options: ZRangeOptions = {}): Promise<string[]> {
    return this.run('zrange', [key, min, max, options], () => {
      const sorted = [...(this.zsets.get(key)?.entries() ?? [])].sort((a, b) => a[1] - b[1]);
      if (!options.byScore) {
        const start = Number(min);
        const stop = Number(max);
        const end = stop < 0 ? sorted.length + stop + 1 : stop + 1;
        return sorted.slice(start, end).map(([member]) => member);
      }
      const inRange = sorted.filter(([, score]) => above(score, min) && below(score, max));
      const offset = options.offset ?? 0;
      const limited =
        options.count === undefined
          ? inRange.slice(offset)
          : inRange.slice(offset, offset + options.count);
      return limited.map(([member]) => member);
    });
  }

  zrem(key: string, ...members: string[]): Promise<number> {
    return this.run('zrem', [key, ...members], () => {
      const set = this.zsets.get(key);
      return members.filter((member) => set?.delete(member)).length;
    });
  }

  zremrangebyscore(key: string, min: Bound, max: Bound): Promise<number> {
    return this.run('zremrangebyscore', [key, min, max], () => {
      const set = this.zsets.get(key);
      let removed = 0;
      for (const [member, score] of set ?? []) {
        if (above(score, min) && below(score, max)) {
          set?.delete(member);
          removed += 1;
        }
      }
      return removed;
    });
  }

  set(key: string, value: unknown, options?: { pxat?: number }): Promise<'OK'> {
    return this.run('set', options ? [key, value, options] : [key, value], () => {
      this.strings.set(key, { value, ...(options?.pxat ? { pxat: options.pxat } : {}) });
      return 'OK' as const;
    });
  }

  get<T>(key: string): Promise<T | null> {
    return this.run('get', [key], () => {
      const entry = this.strings.get(key);
      if (!entry) return null;
      if (entry.pxat !== undefined && entry.pxat <= this.now()) {
        this.strings.delete(key);
        return null;
      }
      return entry.value as T;
    });
  }

  del(...keys: string[]): Promise<number> {
    return this.run('del', keys, () => keys.filter((key) => this.strings.delete(key)).length);
  }

  /** Queues sorted-set reads and runs them on `exec()`, which counts as one recorded request. */
  pipeline(): FakePipeline {
    const queued: Array<() => Promise<unknown>> = [];
    const pipeline: FakePipeline = {
      zscore: (key, member) => {
        queued.push(() => this.zscore(key, member));
        return pipeline;
      },
      zrange: (key, min, max, options) => {
        queued.push(() => this.zrange(key, min, max, options));
        return pipeline;
      },
      exec: async <T extends unknown[]>() => {
        this.pipelines += 1;
        return (await Promise.all(queued.map((command) => command()))) as T;
      },
    };
    return pipeline;
  }

  /** Number of pipelines executed. */
  pipelines = 0;
}

export interface FakePipeline {
  zscore(key: string, member: string): FakePipeline;
  zrange(key: string, min: Bound, max: Bound, options?: ZRangeOptions): FakePipeline;
  exec<T extends unknown[]>(): Promise<T>;
}
