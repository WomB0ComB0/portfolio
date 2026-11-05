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
 * @file `lint:fix` runs every fixer, and `bun run lint` skips Claude Code's local files.
 *
 * `lint:fix` is run here by the shell, with `biome` and `stylelint` replaced by shell functions
 * that record the call and exit with a chosen code. Lint passes --vcs-use-ignore-file to Biome, so a
 * file the checkout ignores is never checked; the local settings file is not in the repository.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const scripts = (
  JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
  }
).scripts;
const lintFix = scripts['lint:fix'] ?? '';

interface Run {
  readonly status: number | null;
  readonly calls: readonly string[];
}

/** Runs `lint:fix` with stand-ins for Biome and Stylelint that exit with the given codes. */
const runLintFix = (biomeExit: number, stylelintExit: number): Run => {
  const stubs = [
    `biome() { echo "biome $*"; return ${biomeExit}; }`,
    `stylelint() { echo "stylelint $*"; return ${stylelintExit}; }`,
  ].join('\n');
  const result = spawnSync('sh', ['-c', `${stubs}\n${lintFix}`], { encoding: 'utf8' });
  return { status: result.status, calls: result.stdout.trim().split('\n').filter(Boolean) };
};

const isIgnored = (path: string): boolean =>
  spawnSync('git', ['check-ignore', '--quiet', path], { cwd: ROOT }).status === 0;

describe('lint:fix', () => {
  it('runs Biome and then Stylelint, and passes when both pass', () => {
    const run = runLintFix(0, 0);

    expect(run.calls).toEqual([
      expect.stringMatching(/^biome check --write /),
      'stylelint src/**/*.css --fix',
    ]);
    expect(run.status).toBe(0);
  });

  it('still runs the Stylelint fix when Biome leaves errors, and fails', () => {
    const run = runLintFix(1, 0);

    expect(run.calls).toHaveLength(2);
    expect(run.calls[1]).toBe('stylelint src/**/*.css --fix');
    expect(run.status).not.toBe(0);
  });

  it('fails when only Stylelint leaves errors', () => {
    expect(runLintFix(0, 2).status).not.toBe(0);
  });

  it('fails when both leave errors', () => {
    expect(runLintFix(1, 1).status).not.toBe(0);
  });

  it('avoids $?, which Bun Shell (what `bun run` uses on Windows) leaves unexpanded', () => {
    expect(lintFix).not.toContain('$?');
  });
});

describe('files the lint scripts must skip', () => {
  it("ignores Claude Code's local settings, which Biome would otherwise reformat", () => {
    expect(isIgnored('.claude/settings.local.json')).toBe(true);
  });

  it('ignores local agent worktrees', () => {
    expect(isIgnored('.claude/worktrees/some-branch/src/app.ts')).toBe(true);
  });

  it('still checks the files the repository shares', () => {
    expect(isIgnored('biome.json')).toBe(false);
    expect(isIgnored('package.json')).toBe(false);
  });
});
