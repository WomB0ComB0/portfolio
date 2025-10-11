#!/usr/bin/env bun
// -*- typescript -*-
export default (async () =>
  console.log(
    (await import('node:child_process'))
      .execSync(
        [
          'bunx tsr',
          '--write',
          '--recursive',
          "'^src/.*\\.(ts|tsx)$'",
          "'^packages/.*\\.(ts|tsx)$'",
          "--exclude '^[^/]+\\.ts$'",
          "--exclude '^\\.[^/]+/'",
          "--exclude 'node_modules/'",
        ].join(' '),
        { encoding: 'utf-8', shell: '/bin/bash' },
      )
      .toString(),
  ))();
