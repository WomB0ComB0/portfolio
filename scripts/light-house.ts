#!/usr/bin/env bun
// -*- typescript -*-

/**
 * @file This script automates the process of running web performance audits using Unlighthouse.
 * It first ensures that Playwright's Chromium browser is installed, then prepares
 * the environment variables by sanitizing `process.env` and injecting the Chromium executable path.
 * Finally, it executes the Unlighthouse command to analyze the configured application URL.
 * The script provides real-time output from the installation and auditing processes.
 *
 * @author Your Name/Organization
 * @see {@link https://unlighthouse.dev/ Unlighthouse Documentation} for detailed configuration and usage.
 * @see {@link https://playwright.dev/docs/ Playwright Documentation} for browser automation specifics.
 * @since 1.0.0
 * @version 1.0.0
 * @async
 * @web This script orchestrates browser automation via Playwright and web performance auditing via Unlighthouse.
 * @throws {Error} If `bunx playwright install chromium` fails, indicating an issue with browser installation.
 * @throws {Error} If `bunx unlighthouse` fails, indicating a problem during the site auditing process.
 * @example
 * // To execute this script, simply run it with Bun:
 * // bun script.ts
 */
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
        `${(await import('@/constants')).app.url}`,
        '--debug',
        '--no-cache',
        '--throttle',
        '--samples',
        '5',
        // '--desktop',
        '--output-path',
        '../.unlighthouse',
      ],
      { stdio: 'inherit', env: stringEnv as any },
    ).toString(),
  );
})();
