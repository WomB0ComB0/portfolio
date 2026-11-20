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
 * @file The same-origin caption path (/assets/sanity-files/...) and the image optimizer, resolved
 * the way Next resolves next.config.ts: the server's path matcher plus destination compiler, and the
 * routes-manifest regex the deployment uses. Only this project's and dataset's WebVTT assets may be
 * rewritten to the Sanity CDN; every other path must match no rewrite (a 404). The optimizer must
 * refuse other hosts' images.
 */

import { buildCustomRoute } from 'next/dist/lib/build-custom-route';
import { hasLocalMatch } from 'next/dist/shared/lib/match-local-pattern';
import { hasRemoteMatch } from 'next/dist/shared/lib/match-remote-pattern';
import { getPathMatch } from 'next/dist/shared/lib/router/utils/path-match';
import { prepareDestination } from 'next/dist/shared/lib/router/utils/prepare-destination';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { PortfolioMedia } from '@/components/portfolio-media';
import { SANITY_CAPTIONS_HEADERS, sanityCaptionsRewrite } from '@/config/sanity-files';
import type { PortfolioMediaItem } from '@/hooks/sanity/schemas';

const { PROJECT, DATASET } = vi.hoisted(() => ({ PROJECT: 'ownproj1', DATASET: 'production' }));

// next.config.ts validates the environment on import and wraps the config in build plugins. Only
// the two public Sanity values matter here, and each plugin hands the config back unchanged.
vi.mock('../../../src/env', () => {
  const env = { NEXT_PUBLIC_SANITY_PROJECT_ID: PROJECT, NEXT_PUBLIC_SANITY_DATASET: DATASET };
  return { env, default: env };
});
vi.mock('@million/lint', () => ({ default: { next: () => (config: unknown) => config } }));
vi.mock('@next/bundle-analyzer', () => ({ default: () => (config: unknown) => config }));
vi.mock('@sentry/nextjs/config', () => ({ withSentryConfig: (config: unknown) => config }));
vi.mock('@/lib/sanity/client', async () => {
  const { createImageUrlBuilder } = await import('@sanity/image-url');
  const builder = createImageUrlBuilder({ projectId: 'ownproj1', dataset: 'production' });
  return { urlFor: (source: Parameters<typeof builder.image>[0]) => builder.image(source) };
});

interface Rewrite {
  source: string;
  destination: string;
}
interface HeaderRule {
  source: string;
  headers: Array<{ key: string; value: string }>;
}
type ImagesConfig = {
  remotePatterns?: Parameters<typeof hasRemoteMatch>[1];
  localPatterns?: Parameters<typeof hasLocalMatch>[0];
  unoptimized?: boolean;
};

/** A Sanity file asset name: the SHA-1 of the file, 40 lower-case hex characters. */
const ASSET = '0123456789abcdef0123456789abcdef01234567';
const OWN_PATH = `/assets/sanity-files/${PROJECT}/${DATASET}/${ASSET}.vtt`;
const OWN_CDN_URL = `https://cdn.sanity.io/files/${PROJECT}/${DATASET}/${ASSET}.vtt`;

let rewrites: Rewrite[] = [];
let headerRules: HeaderRule[] = [];
let images: ImagesConfig = {};

beforeAll(async () => {
  // The config's optional optimisation lists may be missing here; that warning isn't under test.
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  try {
    const { default: config } = await import('../../../next.config');
    const loaded = await config.rewrites?.();
    rewrites = (Array.isArray(loaded) ? loaded : []) as Rewrite[];
    headerRules = ((await config.headers?.()) ?? []) as HeaderRule[];
    images = (config.images ?? {}) as ImagesConfig;
  } finally {
    warn.mockRestore();
  }
});

/** Whether the routes-manifest regex for `rule` (what the deployment matches) accepts `path`. */
const manifestMatches = (rule: Rewrite, path: string) =>
  new RegExp(buildCustomRoute('rewrite', rule).regex).test(path);

/**
 * Where the Next server sends `path`: the first rewrite whose source matches, with its destination
 * compiled from the matched params. `undefined` means no rewrite matched, so the request 404s.
 */
function rewriteTarget(rules: readonly Rewrite[], path: string): string | undefined {
  for (const rule of rules) {
    const params = getPathMatch(rule.source, { strict: true, removeUnnamedParams: true })(path);
    if (!params) continue;
    const { parsedDestination } = prepareDestination({
      appendParamsToQuery: true,
      destination: rule.destination,
      params,
      query: {},
    });
    const { protocol, hostname, pathname } = parsedDestination;
    return hostname ? `${protocol}//${hostname}${pathname}` : pathname;
  }
  return undefined;
}

describe('sanityCaptionsRewrite', () => {
  const rule = sanityCaptionsRewrite(PROJECT, DATASET);

  it('rewrites a caption file of this project and dataset to the same file on the Sanity CDN', () => {
    expect(rule).toBeDefined();
    if (!rule) return;
    expect(rewriteTarget([rule], OWN_PATH)).toBe(OWN_CDN_URL);
    expect(manifestMatches(rule, OWN_PATH)).toBe(true);
  });

  it.each([
    ['another project', `/assets/sanity-files/zzzz0000/${DATASET}/${ASSET}.vtt`],
    ['another dataset', `/assets/sanity-files/${PROJECT}/staging/${ASSET}.vtt`],
    ['another project and dataset', `/assets/sanity-files/abcd1234/next/${ASSET}.pdf`],
    ['no project or dataset', `/assets/sanity-files/${ASSET}.vtt`],
    ['a PDF', `/assets/sanity-files/${PROJECT}/${DATASET}/${ASSET}.pdf`],
    ['an SVG', `/assets/sanity-files/${PROJECT}/${DATASET}/${ASSET}.svg`],
    ['an HTML file', `/assets/sanity-files/${PROJECT}/${DATASET}/${ASSET}.html`],
    ['a video', `/assets/sanity-files/${PROJECT}/${DATASET}/${ASSET}.mp4`],
    ['a double extension', `/assets/sanity-files/${PROJECT}/${DATASET}/${ASSET}.vtt.html`],
    ['no extension', `/assets/sanity-files/${PROJECT}/${DATASET}/${ASSET}`],
    ['a short name', `/assets/sanity-files/${PROJECT}/${DATASET}/${ASSET.slice(1)}.vtt`],
    ['a long name', `/assets/sanity-files/${PROJECT}/${DATASET}/${ASSET}0.vtt`],
    ['a non-hex name', `/assets/sanity-files/${PROJECT}/${DATASET}/${'g'.repeat(40)}.vtt`],
    ['a readable name', `/assets/sanity-files/${PROJECT}/${DATASET}/captions.vtt`],
    ['an extra segment', `/assets/sanity-files/${PROJECT}/${DATASET}/${ASSET}.vtt/x.pdf`],
    ['a nested file', `/assets/sanity-files/${PROJECT}/${DATASET}/sub/${ASSET}.vtt`],
    ['the bare prefix', '/assets/sanity-files/'],
  ])('matches no rewrite for %s', (_name, path) => {
    expect(rule).toBeDefined();
    if (!rule) return;
    expect(rewriteTarget([rule], path)).toBeUndefined();
    expect(manifestMatches(rule, path)).toBe(false);
  });

  it.each([
    [
      'dot segments',
      `/assets/sanity-files/${PROJECT}/${DATASET}/../../zzzz0000/${DATASET}/${ASSET}.vtt`,
    ],
    [
      'encoded slashes',
      `/assets/sanity-files/${PROJECT}/${DATASET}/..%2F..%2Fzzzz0000%2F${ASSET}.vtt`,
    ],
    ['encoded dots', `/assets/sanity-files/${PROJECT}/${DATASET}/%2e%2e/%2e%2e/x/${ASSET}.vtt`],
    ['a backslash', `/assets/sanity-files/${PROJECT}/${DATASET}/..\\..\\x\\${ASSET}.vtt`],
    ['an encoded name', `/assets/sanity-files/${PROJECT}/${DATASET}/${ASSET}%2Evtt`],
    [
      'a traversal after the name',
      `/assets/sanity-files/${PROJECT}/${DATASET}/${ASSET}.vtt/../x.pdf`,
    ],
  ])('matches no rewrite for path traversal with %s', (_name, path) => {
    expect(rule).toBeDefined();
    if (!rule) return;
    expect(rewriteTarget([rule], path)).toBeUndefined();
    expect(manifestMatches(rule, path)).toBe(false);
  });

  it('can only reach this project and dataset, whatever matches (the server matcher ignores case)', () => {
    expect(rule).toBeDefined();
    if (!rule) return;
    const own = new RegExp(
      `^https://cdn\\.sanity\\.io/files/${PROJECT}/${DATASET}/[0-9a-f]{40}\\.vtt$`,
      'iu',
    );
    for (const path of [
      OWN_PATH,
      OWN_PATH.toUpperCase(),
      `/assets/sanity-files/${PROJECT.toUpperCase()}/${DATASET}/${ASSET}.vtt`,
      `/assets/sanity-files/${PROJECT}/${DATASET}/${ASSET.toUpperCase()}.VTT`,
    ]) {
      const target = rewriteTarget([rule], path);
      if (target) expect(target, path).toMatch(own);
      if (target) expect(target, path).toContain(`/files/${PROJECT}/${DATASET}/`);
    }
  });

  it.each([
    ['a missing project id', undefined, DATASET],
    ['an empty project id', '', DATASET],
    ['a missing dataset', PROJECT, undefined],
    ['an empty dataset', PROJECT, ''],
    ['a project id with a slash', 'own/../x', DATASET],
    ['a project id with route syntax', ':path*', DATASET],
    ['an upper-case project id', 'OwnProj1', DATASET],
    ['a dataset with a slash', PROJECT, 'production/..'],
    ['a dataset with route syntax', PROJECT, '(.*)'],
    ['a dataset starting with a dash', PROJECT, '-production'],
    ['an over-long dataset', PROJECT, 'a'.repeat(65)],
  ])('adds no rewrite for %s (fails closed: every path 404s)', (_name, projectId, dataset) => {
    expect(sanityCaptionsRewrite(projectId, dataset)).toBeUndefined();
  });
});

describe('next.config.ts rewrites()', () => {
  it('rewrites only this project and dataset caption files to cdn.sanity.io', () => {
    const sanityRules = rewrites.filter((rule) => rule.destination.includes('cdn.sanity.io'));
    expect(sanityRules).toEqual([sanityCaptionsRewrite(PROJECT, DATASET)]);
    expect(rewriteTarget(rewrites, OWN_PATH)).toBe(OWN_CDN_URL);
  });

  it.each([
    `/assets/sanity-files/zzzz0000/${DATASET}/${ASSET}.vtt`,
    `/assets/sanity-files/${PROJECT}/staging/${ASSET}.vtt`,
    `/assets/sanity-files/${PROJECT}/${DATASET}/${ASSET}.pdf`,
    `/assets/sanity-files/${PROJECT}/${DATASET}/..%2F..%2Fzzzz0000%2F${ASSET}.vtt`,
  ])('leaves %s to 404', (path) => {
    expect(rewriteTarget(rewrites, path)).toBeUndefined();
    for (const rule of rewrites) expect(manifestMatches(rule, path), rule.source).toBe(false);
  });

  it('rewrites the caption track PortfolioMedia renders for an uploaded video', () => {
    const video: PortfolioMediaItem = {
      _key: 'video',
      _type: 'portfolioVideo',
      title: 'Delivery walkthrough',
      file: {
        url: `https://cdn.sanity.io/files/${PROJECT}/${DATASET}/${'f'.repeat(40)}.mp4`,
        mimeType: 'video/mp4',
      },
      captionsFile: { url: OWN_CDN_URL, mimeType: 'text/vtt' },
      captionsLanguage: 'en',
      captionsLabel: 'English',
    };
    const html = renderToStaticMarkup(<PortfolioMedia id="media" media={[video]} />);
    const src = /<track[^>]*\ssrc="([^"]+)"/u.exec(html)?.[1];
    expect(src).toBe(OWN_PATH);
    expect(rewriteTarget(rewrites, src ?? '')).toBe(OWN_CDN_URL);
  });
});

describe('next.config.ts headers() for caption files', () => {
  const headersFor = (path: string) => {
    const sent = new Map<string, string>();
    for (const rule of headerRules) {
      if (!new RegExp(buildCustomRoute('header', rule).regex).test(path)) continue;
      for (const { key, value } of rule.headers) sent.set(key.toLowerCase(), value);
    }
    return sent;
  };

  it('serves a caption file as WebVTT with a sandboxing CSP', () => {
    const sent = headersFor(OWN_PATH);
    for (const { key, value } of SANITY_CAPTIONS_HEADERS) {
      expect(sent.get(key.toLowerCase()), key).toBe(value);
    }
  });

  it('does not put the caption headers on pages or other files', () => {
    for (const path of ['/', '/projects', '/assets/sanity-files/', `/x/${ASSET}.vtt`]) {
      expect(headersFor(path).get('content-type'), path).toBeUndefined();
    }
  });
});

describe('next.config.ts images', () => {
  it('gives the optimizer no remote hosts, so /_next/image relays no other host', () => {
    expect(images.remotePatterns).toEqual([]);
    for (const url of [
      `https://cdn.sanity.io/images/zzzz0000/${DATASET}/a-1x1.png`,
      `https://cdn.sanity.io/images/${PROJECT}/${DATASET}/a-1x1.png`,
      'https://res.cloudinary.com/anyone/image/upload/a.png',
      'https://avatars.githubusercontent.com/u/1',
      'https://mikeodnis.dev/a.png',
    ]) {
      expect(hasRemoteMatch([], images.remotePatterns ?? [], new URL(url)), url).toBe(false);
    }
  });

  it('allows no local path either, so it cannot fetch through a rewrite', () => {
    // Next adds its own static-import pattern (/_next/static/media/**) when the config loads.
    expect(images.localPatterns).toEqual([]);
    for (const path of ['/images/a.png', OWN_PATH, '/api/og?title=x']) {
      expect(hasLocalMatch(images.localPatterns, path), path).toBe(false);
    }
  });

  it('keeps the optimizer flag off, which would also drop the CDN loader srcset', () => {
    expect(images.unoptimized).not.toBe(true);
  });
});
