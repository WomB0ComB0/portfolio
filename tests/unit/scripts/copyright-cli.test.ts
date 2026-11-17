/**
 * Copyright 2026 Mike Odnis
 * Licensed under the Apache License, Version 2.0.
 */

import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const script = resolve('scripts/copyright.ts');
const directories: string[] = [];

function fixture(): string {
  const directory = mkdtempSync(join(tmpdir(), 'portfolio-license-'));
  directories.push(directory);
  const init = spawnSync('git', ['init', '--quiet'], { cwd: directory });
  if (init.status !== 0) throw new Error('Cannot create isolated git fixture');
  writeFileSync(
    join(directory, 'covered.ts'),
    '// Copyright 2026 Mike Odnis\nexport const ready = true;\n',
  );
  const add = spawnSync('git', ['add', 'covered.ts'], { cwd: directory });
  if (add.status !== 0) throw new Error('Cannot stage fixture');
  return directory;
}

function run(directory: string, mode = '--check') {
  const result = spawnSync('bun', ['run', script, mode, '--ext', 'ts'], {
    cwd: directory,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
    timeout: 20_000,
  });
  return { status: result.status, output: result.stdout + result.stderr };
}

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe('copyright CLI results', () => {
  it('passes readable covered files', () => {
    const result = run(fixture());
    expect(result.status).toBe(0);
    expect(result.output).toContain('All files have license headers');
  });

  it('names missing headers and fails', () => {
    const directory = fixture();
    writeFileSync(join(directory, 'needs-header.ts'), 'export const uncovered = true;\n');
    const result = run(directory);
    expect(result.status).toBe(1);
    expect(result.output).toContain('needs-header.ts');
    expect(result.output).not.toContain('All files have license headers');
  });

  it('does not try to read a tracked file intentionally deleted from the worktree', () => {
    const directory = fixture();
    writeFileSync(join(directory, 'retired.ts'), 'export const retired = true;\n');
    spawnSync('git', ['add', 'retired.ts'], { cwd: directory });
    unlinkSync(join(directory, 'retired.ts'));
    const result = run(directory);
    expect(result.status).toBe(0);
    expect(result.output).not.toContain('ENOENT');
    expect(result.output).toContain('All files have license headers');
  });

  it
    .skipIf(process.platform === 'win32' || process.getuid?.() === 0)
    .each(['--check', '--dry-run'])(
    'fails %s when a present source file cannot be read',
    (mode) => {
      const directory = fixture();
      const file = join(directory, 'unreadable.ts');
      writeFileSync(file, 'export const unreadable = true;\n');
      spawnSync('git', ['add', 'unreadable.ts'], { cwd: directory });
      chmodSync(file, 0o000);
      try {
        const result = run(directory, mode);
        expect(result.output).toContain('EACCES');
        expect(result.status).toBe(1);
        expect(result.output).not.toContain('All files have license headers');
      } finally {
        chmodSync(file, 0o600);
      }
    },
  );
});
