#!/usr/bin/env bun
// -*- typescript -*-

export default (async () => {
  const { chromium } = await import('playwright');
  const { execFileSync } = await import('node:child_process');
  execFileSync('bunx', ['playwright', 'install', 'chromium'], { stdio: 'inherit' });
  const chromiumPath = chromium.executablePath();
  const stringEnv: Record<string, string> = {};
  for (const k in process.env) {
    const v = process.env[k];
    stringEnv[k] = v === undefined ? '' : String(v);
  }
  stringEnv.BROWSER = chromiumPath;
  console.log(
    execFileSync(
      'bunx',
      [
        'unlighthouse',
        '--site',
        `${(await import('../packages/shared/src/constants')).app.url}`,
        '--debug',
        '--no-cache',
        '--throttle',
        '--samples',
        '5',
        // '--desktop',
        '--output-path',
        '../../.unlighthouse',
      ],
      { stdio: 'inherit', env: stringEnv as any },
    ).toString(),
  );
})();
