// @vitest-environment node
/**
 * Copyright 2026 Mike Odnis
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
 * @file package.json's browserslist: Safari 16.4 to 17 get the edge haze's scrim, and next-swc
 * leaves BigInt `**` alone.
 *
 * The owner chose (7 Nov, #614) to keep Safari 16.4 to 17 on the scrim: the build drops the
 * -webkit-backdrop-filter twins, and the haze's fallback then tests the unprefixed property only.
 * The old list ('defaults', 'not dead', ...) did that, but it also made the client bundle rewrite
 * `a ** b` as Math.pow(a, b), which throws on BigInt (effect's BigDecimal computes
 * `bigint10 ** BigInt(exponent)`), so #701 removed it. This list is pinned like Next's own default
 * (chrome 111, edge 111, firefox 111, safari 16.4), one version per browser, with Safari raised to
 * 18.0: the JS is the same as Next's default, and only the CSS changes.
 *
 * Next resolves the list with next/dist/build/get-supported-browsers and hands it to next-swc (JS)
 * and Lightning CSS (CSS). The checks run the same native bindings the build uses.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { beforeAll, describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const requireFromRoot = createRequire(join(ROOT, 'package.json'));

/** The list in package.json: Next's default with the Safari floor at 18.0. */
const TARGETS = ['chrome 111', 'edge 111', 'firefox 111', 'safari 18.0'];

/** Browsers next-swc has no versions for: any of them in the list compiles the bundle to ES5. */
const ES5_FALLBACK_BROWSERS = [
  'and_qq',
  'and_uc',
  'baidu',
  'bb',
  'ie',
  'ie_mob',
  'kaios',
  'op_mini',
];

/** effect's BigDecimal power of ten, the BigInt `**` that broke under the old list. */
const BIGINT_POWER = [
  'const bigint10 = BigInt(10);',
  'globalThis.powerOfTen = (exponent) => bigint10 ** BigInt(exponent);',
].join('\n');

/** Modern syntax the bundle relies on, to compare next-swc's output for two target lists. */
const MODERN_SYNTAX = [
  'class A { #p = 1; static s = 2; static { A.t = 3; } #m() { return this.#p; } has(o) { return #p in o; } }',
  'let x = null; x ??= 1; x ||= 2; x &&= 3;',
  'const c = globalThis.o?.a?.b ?? 0; const n = 1_000_000; const p = (a, b) => a ** b;',
  'const re1 = /[\\p{L}--[a-z]]/v; const re2 = /(?<y>\\d{4})-\\d|(?<y>\\d{2})/;',
  'async function* gen() { for await (const v of [Promise.resolve(1)]) yield v; }',
  'const { a, ...rest } = { a: 1, b: 2 }; const t = String.raw`a\\nb`;',
  'try { JSON.parse("{"); } catch { globalThis.failed = true; }',
  'export { A, c, n, p, re1, re2, gen, rest, t };',
].join('\n');

type SupportedBrowsers = (dir: string, isDevelopment: boolean) => string[];

interface SwcBindings {
  css: {
    lightning: {
      transform: (options: {
        filename: string;
        code: Buffer;
        targets: Record<string, number>;
        minify: boolean;
        include: number;
        exclude: number;
      }) => { code: Buffer };
    };
  };
}

interface SwcModule {
  loadBindings: () => Promise<unknown>;
  getBindingsSync: () => SwcBindings;
  transform: (code: string, options: Record<string, unknown>) => Promise<{ code: string }>;
}

const { getSupportedBrowsers } = requireFromRoot('next/dist/build/get-supported-browsers') as {
  getSupportedBrowsers: SupportedBrowsers;
};
const NEXT_DEFAULT = requireFromRoot('next/dist/shared/lib/modern-browserslist-target') as string[];
const swc = requireFromRoot('next/dist/build/swc') as SwcModule;

/** The production list as Next resolves it from package.json. */
const RESOLVED = getSupportedBrowsers(ROOT, false);

/** next-swc's output for `code` built for `targets`, as Next's SWC loader passes them. */
async function compileJs(code: string, targets: string[]): Promise<string> {
  const { code: out } = await swc.transform(code, {
    filename: 'probe.js',
    isModule: true,
    jsc: { parser: { syntax: 'ecmascript' } },
    env: { targets },
    minify: false,
  });
  return out;
}

/** A list entry's browser name: 'safari 18.0' is 'safari'. */
const browserName = (entry: string): string => entry.slice(0, entry.indexOf(' '));

/** Lightning CSS targets: each browser's lowest version as major << 16 | minor << 8 | patch. */
function cssTargets(browsers: string[]): Record<string, number> {
  const targets: Record<string, number> = {};
  for (const entry of browsers) {
    const name = browserName(entry);
    // 'ios_saf 18.0-18.2' is a range: its first version is the floor.
    const version = entry.slice(name.length + 1).split('-', 1)[0] ?? '';
    const [major = 0, minor = 0, patch = 0] = version.split('.').map(Number);
    const encoded = (major << 16) | (minor << 8) | patch;
    const lowest = targets[name];
    if (lowest === undefined || encoded < lowest) targets[name] = encoded;
  }
  return targets;
}

/** A stylesheet as Lightning CSS builds it for `browsers`, minified as production is. */
function compileCss(file: string, browsers: string[]): string {
  const { code } = swc.getBindingsSync().css.lightning.transform({
    filename: file,
    code: readFileSync(join(ROOT, file)),
    targets: cssTargets(browsers),
    minify: true,
    include: 0,
    exclude: 0,
  });
  return code.toString();
}

beforeAll(async () => {
  // No wasm download: the native binding is installed with next, and wasm has no Lightning CSS.
  process.env.NEXT_DISABLE_SWC_WASM ??= '1';
  await swc.loadBindings();
}, 60_000);

describe('package.json browserslist', () => {
  it.each([
    ['production', false],
    ['development', true],
  ])('resolves to the pinned list in %s, one version per browser', (_env, isDevelopment) => {
    // An open-ended query ('defaults', 'last 2 versions', 'safari >= 18') resolves to the newest
    // caniuse-lite versions, which next-swc's own browser table may not know yet.
    expect(getSupportedBrowsers(ROOT, isDevelopment)).toEqual(TARGETS);
  });

  it('names no browser that sends next-swc back to ES5', () => {
    const names = RESOLVED.map(browserName);
    expect(names.filter((name) => ES5_FALLBACK_BROWSERS.includes(name))).toEqual([]);
  });

  it('differs from Next’s default list only in the Safari floor', () => {
    const others = (list: string[]) => list.filter((entry) => !entry.startsWith('safari '));
    expect(others(RESOLVED)).toEqual(others(NEXT_DEFAULT));
  });

  it('compiles the same JavaScript as Next’s default list', async () => {
    const ours = await compileJs(MODERN_SYNTAX, RESOLVED);
    expect(ours).toBe(await compileJs(MODERN_SYNTAX, NEXT_DEFAULT));
  });
});

describe('BigInt exponentiation', () => {
  const run = (code: string) => {
    const context: {
      BigInt: typeof BigInt;
      globalThis?: unknown;
      powerOfTen?: (e: number) => bigint;
    } = { BigInt };
    context.globalThis = context;
    runInNewContext(code, context);
    return context.powerOfTen?.(3);
  };

  it('keeps `**` on BigInt for the whole list, and the result is a BigInt', async () => {
    const out = await compileJs(BIGINT_POWER, RESOLVED);
    expect(out).not.toContain('Math.pow');
    expect(run(out)).toBe(1000n);
  });

  // One entry next-swc cannot map (op_mini, kaios, ...) is enough to rewrite `**` as Math.pow.
  it.each(RESOLVED)('keeps `**` on BigInt for %s alone', async (target) => {
    const out = await compileJs(BIGINT_POWER, [target]);
    expect(out).not.toContain('Math.pow');
    expect(run(out)).toBe(1000n);
  });

  it('leaves effect’s BigDecimal free of Math.pow', async () => {
    const file = requireFromRoot.resolve('effect/BigDecimal');
    const out = await compileJs(readFileSync(file, 'utf8'), RESOLVED);
    expect(out).toContain('bigint10 ** BigInt(');
    expect(out).not.toContain('Math.pow');
  });
});

describe('the edge haze as built', () => {
  const HAZE = 'src/styles/edge-haze.css';

  it('drops every -webkit-backdrop-filter twin and keeps the unprefixed blur', () => {
    const css = compileCss(HAZE, RESOLVED);
    expect(css).not.toContain('-webkit-backdrop-filter');
    expect(css).toContain('backdrop-filter:blur(var(--edge-haze-blur))');
  });

  it('tests the unprefixed property for the scrim, so Safari 16.4 to 17 get the scrim', () => {
    const css = compileCss(HAZE, RESOLVED);
    expect(css).toContain('@supports not (backdrop-filter:blur(1px))');
    expect(css).not.toContain('@supports not ((-webkit-backdrop-filter');
  });

  it('keeps the -webkit-mask-image twins for Chrome 111 to 119', () => {
    const css = compileCss(HAZE, RESOLVED);
    expect(css).toContain('-webkit-mask-image:var(--edge-haze-fade)');
  });

  it('would keep the twins under Next’s default list (Safari 16.4), which is what this list undoes', () => {
    const css = compileCss(HAZE, NEXT_DEFAULT);
    expect(css).toContain('-webkit-backdrop-filter');
    expect(css).toContain(
      '@supports not ((-webkit-backdrop-filter:blur(1px)) or (backdrop-filter:blur(1px)))',
    );
  });
});
