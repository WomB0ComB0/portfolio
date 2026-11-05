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
 * @file Generated reports in scripts/out come out the way `biome ci` (in `bun run lint`) wants.
 *
 * JSON.stringify(x, null, 2) puts every array entry on its own line; Biome joins an array that fits
 * within the 100-column line width. A seven-entry high.json, one package fewer than today's, is the
 * case that broke lint. These run the repository's real Biome on files in a temporary directory.
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatWithBiome } from '../../../scripts/format-with-biome';

// Vitest runs from the repository root, where biome.json is.
const ROOT = process.cwd();

const SEVEN_HIGH_TIER = [
  'next',
  'react-icons',
  'firebase',
  'lucide-react',
  'sanity',
  '@effect/platform',
  'date-fns',
];

/** Longer than one 100-column line, so Biome keeps one entry per line. */
const MANY = Array.from({ length: 20 }, (_, i) => `@scope/package-number-${i}`);

let dir: string;

const writeReport = (name: string, data: unknown): string => {
  const file = join(dir, name);
  writeFileSync(file, JSON.stringify(data, null, 2));
  return file;
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'format-with-biome-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('formatWithBiome', () => {
  it('joins a short array onto one line, as biome ci expects', () => {
    const file = writeReport('high.json', SEVEN_HIGH_TIER);

    expect(formatWithBiome([file], ROOT)).toBe(true);

    expect(readFileSync(file, 'utf8')).toBe(
      '["next", "react-icons", "firebase", "lucide-react", "sanity", "@effect/platform", "date-fns"]\n',
    );
  });

  it('formats every file it is given and keeps what each report says', () => {
    const short = writeReport('high.json', SEVEN_HIGH_TIER);
    const long = writeReport('low.json', MANY);

    expect(formatWithBiome([short, long], ROOT)).toBe(true);

    expect(JSON.parse(readFileSync(short, 'utf8'))).toEqual(SEVEN_HIGH_TIER);
    expect(readFileSync(long, 'utf8')).toBe(`${JSON.stringify(MANY, null, 2)}\n`);
  });

  it('runs nothing for no files', () => {
    expect(formatWithBiome([], ROOT)).toBe(true);
  });

  it('warns and leaves the report as written when Biome rejects a file', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const file = writeReport('high.json', SEVEN_HIGH_TIER);
    const missing = join(dir, 'missing.json');

    expect(formatWithBiome([missing], ROOT)).toBe(false);

    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0]?.[0])).toContain('missing.json');
    expect(readFileSync(file, 'utf8')).toBe(JSON.stringify(SEVEN_HIGH_TIER, null, 2));
  });

  it('warns instead of throwing when Biome cannot be run at all', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubEnv('PATH', join(dir, 'no-such-bin'));
    const file = writeReport('high.json', SEVEN_HIGH_TIER);

    expect(formatWithBiome([file], ROOT)).toBe(false);

    expect(warn).toHaveBeenCalledOnce();
    expect(readFileSync(file, 'utf8')).toBe(JSON.stringify(SEVEN_HIGH_TIER, null, 2));
  });
});
