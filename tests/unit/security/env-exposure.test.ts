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
 * @file Guards against shipping credentials to the browser.
 *
 * Next.js inlines the value of every `NEXT_PUBLIC_*` variable that code references into the
 * client bundles, so a secret with that prefix is public. The Upstash Redis REST token and the
 * Hashnode personal access token both leaked this way.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Vitest runs from the repository root (where vitest.config.ts lives); under jsdom
// import.meta.url is not a file: URL, so resolve from the working directory instead.
const ROOT = process.cwd();
const SOURCE_FILE = /\.(?:[cm]?ts|tsx|[cm]?js|jsx)$/;
const ENV_TEMPLATE = /^\.env.*\.example$/;
const WORKFLOW_FILE = /\.ya?ml$/;
const WORKFLOWS_DIR = join('.github', 'workflows');

const PUBLIC_PREFIX = 'NEXT_PUBLIC_';
const PUBLIC_NAME = /\bNEXT_PUBLIC_[A-Z0-9_]+/g;
/** Words that mark a credential whatever else the name says. */
const ALWAYS_SECRET = /SECRET|TOKEN|PASSWORD|PRIVATE|CREDENTIAL/;
/**
 * Most API keys are credentials too; the ones below are public by design. KEY must be a whole word
 * of the name (API_KEY, KEY_ID, SIGNING_KEYS), so KEYWORDS or HOCKEY is not taken for a key.
 */
const KEY = /(?:^|_)KEYS?(?:_|$)/;
const PUBLIC_BY_DESIGN: ReadonlySet<string> = new Set([
  // Firebase web config: identifies the project to the client SDK, guarded by security rules.
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  // Maps JavaScript API browser key, restricted by HTTP referrer.
  'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY',
  // Liveblocks public key, issued for use in the browser.
  'NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY',
]);

function isSecretLike(name: string): boolean {
  const rest = name.slice(PUBLIC_PREFIX.length);
  if (ALWAYS_SECRET.test(rest)) return true;
  return KEY.test(rest) && !PUBLIC_BY_DESIGN.has(name);
}

/** Returns each distinct NEXT_PUBLIC_ name in `text` that looks like a credential. */
function secretLikePublicNames(text: string): string[] {
  return [...new Set(text.match(PUBLIC_NAME) ?? [])].filter(isSecretLike);
}

function offendersIn(files: readonly string[]): string[] {
  return files.flatMap((file) =>
    secretLikePublicNames(readFileSync(join(ROOT, file), 'utf8')).map((name) => `${file}: ${name}`),
  );
}

/** Returns the text between `<label>: {` and its matching closing brace. */
function block(source: string, label: string): string {
  const start = source.indexOf(`${label}: {`);
  if (start < 0) throw new Error(`no "${label}" block in src/env.ts`);
  let depth = 0;
  for (let i = source.indexOf('{', start); i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated "${label}" block in src/env.ts`);
}

function bundledSourceFiles(): string[] {
  const inSrc = (readdirSync(join(ROOT, 'src'), { recursive: true }) as string[])
    .filter((p) => SOURCE_FILE.test(p))
    .map((p) => join('src', p));
  const rootFiles = readdirSync(ROOT).filter((p) =>
    /^(?:next\.config|instrumentation[\w-]*)\.[cm]?ts$/.test(p),
  );
  return [...inSrc, ...rootFiles];
}

/** Env templates, the compose file and CI workflows: where a variable gets its name and value. */
function configFiles(): string[] {
  const templates = readdirSync(ROOT).filter((p) => ENV_TEMPLATE.test(p));
  const workflows = readdirSync(join(ROOT, WORKFLOWS_DIR))
    .filter((p) => WORKFLOW_FILE.test(p))
    .map((p) => join(WORKFLOWS_DIR, p));
  return [...templates, 'docker-compose.yml', ...workflows];
}

describe('secretLikePublicNames', () => {
  it('flags NEXT_PUBLIC_ names that read as secrets, tokens, passwords or private keys', () => {
    // One line each in .env, docker-compose and workflow syntax.
    const fixture = `
NEXT_PUBLIC_PAYMENTS_WEBHOOK_SECRET=
      - NEXT_PUBLIC_CMS_TOKEN=\${NEXT_PUBLIC_CMS_TOKEN}
  KEY: \${{ secrets.KEY || secrets.NEXT_PUBLIC_SERVICE_PRIVATE_KEY }}
NEXT_PUBLIC_DB_PASSWORD=
NEXT_PUBLIC_SERVICE_CREDENTIALS=
`;

    expect(secretLikePublicNames(fixture)).toEqual([
      'NEXT_PUBLIC_PAYMENTS_WEBHOOK_SECRET',
      'NEXT_PUBLIC_CMS_TOKEN',
      'NEXT_PUBLIC_SERVICE_PRIVATE_KEY',
      'NEXT_PUBLIC_DB_PASSWORD',
      'NEXT_PUBLIC_SERVICE_CREDENTIALS',
    ]);
  });

  it('flags an API key unless it is public by design', () => {
    const fixture = 'NEXT_PUBLIC_LLM_API_KEY=\nNEXT_PUBLIC_FIREBASE_API_KEY=\n';

    expect(secretLikePublicNames(fixture)).toEqual(['NEXT_PUBLIC_LLM_API_KEY']);
  });

  it('flags KEY wherever it is a whole word of the name', () => {
    const fixture = `
NEXT_PUBLIC_API_KEY=
NEXT_PUBLIC_GCP_PRIVATE_KEY_ID=
NEXT_PUBLIC_SERVICE_KEY=
NEXT_PUBLIC_KEY_ID=
NEXT_PUBLIC_SIGNING_KEYS=
`;

    expect(secretLikePublicNames(fixture)).toEqual([
      'NEXT_PUBLIC_API_KEY',
      'NEXT_PUBLIC_GCP_PRIVATE_KEY_ID',
      'NEXT_PUBLIC_SERVICE_KEY',
      'NEXT_PUBLIC_KEY_ID',
      'NEXT_PUBLIC_SIGNING_KEYS',
    ]);
  });

  it('does not flag a word that only contains KEY', () => {
    const fixture = `
NEXT_PUBLIC_SEO_KEYWORDS=
NEXT_PUBLIC_KEYCLOAK_URL=
NEXT_PUBLIC_KEYBOARD_LAYOUT=
NEXT_PUBLIC_HOCKEY_TEAM=
`;

    expect(secretLikePublicNames(fixture)).toEqual([]);
  });

  it('ignores server-only names and public names that are not credentials', () => {
    const fixture = `
PAYMENTS_WEBHOOK_SECRET=
  GCP_PRIVATE_KEY: \${{ secrets.GCP_PRIVATE_KEY }}
NEXT_PUBLIC_SANITY_DATASET=production
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY=
# never prefix these with NEXT_PUBLIC_
`;

    expect(secretLikePublicNames(fixture)).toEqual([]);
  });
});

describe('environment variable exposure', () => {
  const envSource = readFileSync(join(ROOT, 'src/env.ts'), 'utf8');

  it('declares no secret-looking client (NEXT_PUBLIC_) variables in src/env.ts', () => {
    expect(secretLikePublicNames(block(envSource, 'client'))).toEqual([]);
  });

  it('keeps the Upstash Redis credentials server-only', () => {
    const server = block(envSource, 'server');
    expect(server).toContain('UPSTASH_REDIS_REST_URL:');
    expect(server).toContain('UPSTASH_REDIS_REST_TOKEN:');
    expect(envSource).not.toContain('NEXT_PUBLIC_UPSTASH_');
  });

  it('references no secret-looking NEXT_PUBLIC_ variable anywhere in bundled code', () => {
    expect(offendersIn(bundledSourceFiles())).toEqual([]);
  });

  it('scans a meaningful number of files (the walker found the source tree)', () => {
    expect(bundledSourceFiles().length).toBeGreaterThan(100);
  });

  it('names no secret NEXT_PUBLIC_ variable in env templates, docker-compose or CI workflows', () => {
    expect(offendersIn(configFiles())).toEqual([]);
  });

  it('scans every env template, the compose file and the workflows', () => {
    const files = configFiles();

    expect(files).toEqual(
      expect.arrayContaining([
        '.env.example',
        '.env.docker.example',
        'docker-compose.yml',
        join(WORKFLOWS_DIR, 'build.yml'),
      ]),
    );
  });
});
