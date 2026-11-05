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
 * @file The Lint check can fail.
 *
 * `bun run lint` once ran each step with `|| true` and with --write/--fix, so CI's Lint job passed
 * whatever the code looked like. The check must only read, and must pass on each tool's exit code.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const scripts = (
  JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
  }
).scripts;
const lint = scripts.lint ?? '';
const steps = lint.split('&&').map((step) => step.trim());

describe('the lint script', () => {
  it('runs Biome and Stylelint', () => {
    expect(steps.some((step) => /^biome (?:ci|check)\b/.test(step))).toBe(true);
    expect(steps.some((step) => step.startsWith('stylelint '))).toBe(true);
  });

  it('never swallows a failing step', () => {
    expect(lint).not.toMatch(/\|\||;|\bexit 0\b/);
  });

  it('only reads: no --write, --fix or --apply', () => {
    expect(lint).not.toMatch(/--(?:write|fix|apply|unsafe)\b/);
  });

  it('quotes the Stylelint glob so the shell cannot expand it', () => {
    const stylelint = steps.find((step) => step.startsWith('stylelint ')) ?? '';

    expect(stylelint).toMatch(/^stylelint "[^"]+"/);
  });

  it('keeps the writing variant as lint:fix', () => {
    expect(scripts['lint:fix']).toMatch(/biome check --write/);
    expect(scripts['lint:fix']).toMatch(/stylelint .*--fix/);
  });

  it('is what the Lint workflow runs', () => {
    const workflow = readFileSync(join(ROOT, '.github', 'workflows', 'lint.yml'), 'utf8');

    expect(workflow).toMatch(/run: bun run lint\s*$/m);
  });
});
