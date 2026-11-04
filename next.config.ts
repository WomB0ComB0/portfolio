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

import MillionLint from '@million/lint';
import withBundleAnalyzer from '@next/bundle-analyzer';
import { withSentryConfig } from '@sentry/nextjs/config';
import type { NextConfig } from 'next';
import './src/env';

// Just in case you accidentally import these packages
// next.config.ts (top-level, before config)
import fs from 'node:fs';
import path from 'node:path';
import { HASHNODE_COVER_PATTERNS } from './src/config/blog-images';
import {
  RETIRED_SERVICE_WORKER_HEADERS,
  RETIRED_SERVICE_WORKER_SOURCE,
} from './src/config/retired-service-worker';
import {
  API_SECURITY_HEADERS,
  API_SECURITY_HEADERS_SOURCE,
  OG_IMAGE_HEADERS,
  OG_IMAGE_HEADERS_SOURCE,
  SECURITY_HEADERS,
  SECURITY_HEADERS_SOURCE,
} from './src/config/security-headers';
import { buildSentryBuildOptions, shouldApplySentryConfig } from './src/config/sentry-build';

function safeReadJSON(p: string) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return undefined;
  }
}

function pkgJsonFor(name: string): any | undefined {
  try {
    // Resolve the package.json within node_modules
    const resolved = require.resolve(path.join(name, 'package.json'), { paths: [process.cwd()] });
    return safeReadJSON(resolved);
  } catch {
    return undefined;
  }
}

/**
 * Heuristics:
 *  - Exempt if package:
 *    1) lacks usable subpath exports (no wildcard or only "." entry),
 *    2) is CJS-only (no "module" and not "type":"module"),
 *    3) declares side effects (true or array incl. *.css),
 *    4) is a build/bundler/runtime plugin or types-only pkg,
 *    5) is in a small known-bad set (community reports).
 *
 * This keeps optimizePackageImports focused on big, safe targets
 * like icon/component libs intentionally exposing subpaths.
 */
function computeExemptDeps(): Set<string> {
  const appPkg = safeReadJSON(path.join(process.cwd(), 'package.json')) ?? {};
  const allDeps = new Set<string>([
    ...Object.keys(appPkg.dependencies ?? {}),
    ...Object.keys(appPkg.devDependencies ?? {}),
    ...Object.keys(appPkg.optionalDependencies ?? {}),
  ]);

  const KNOWN_BAD = new Set<string>([
    '@mantine/modals',
    'react-icons',
    'react-icons/si',
    'lodash',
    'date-fns',
    'classnames',
    'axios',
    'zustand',
    'motion',
    'tailwindcss',
    'autoprefixer',
  ]);

  const EXCLUDE_NAME_RE = new RegExp(
    [
      // tooling, bundlers, analyzers, type pkgs, CSS frameworks
      '^(@types/|eslint|prettier|ts-node|tsup|rollup|vite|webpack|esbuild|babel|postcss|tailwind|stylelint)',
      // server/adapters & next internals not meant for deep import rewrites
      '^(next($|/)|react-dom$|@sentry/|prisma|playwright|jest|vitest|cypress)',
    ].join('|'),
  );

  const results = new Set<string>();

  for (const name of allDeps) {
    if (EXCLUDE_NAME_RE.test(name) || KNOWN_BAD.has(name)) {
      results.add(name);
      continue;
    }

    const pj = pkgJsonFor(name);
    if (!pj) {
      results.add(name);
      continue;
    }

    const isCJSOnly = !pj.module && pj.type !== 'module';
    const side = pj.sideEffects;
    const hasCssSideEffects =
      side === true ||
      (Array.isArray(side) && side.some((p: string) => p.endsWith('.css') || p.includes('*.css')));

    // Detect usable subpaths: exports with "*" or multiple keys beyond "."
    let hasUsableSubpaths = false;
    if (typeof pj.exports === 'string') {
      // single entrypoint only - hasUsableSubpaths remains false
    } else if (pj.exports && typeof pj.exports === 'object') {
      const keys = Object.keys(pj.exports);
      hasUsableSubpaths = keys.some((k) => k.includes('*')) || keys.some((k) => k !== '.');
    }

    // If package has neither subpaths nor wildcards, deep import rewriting is unlikely to help.
    const noSubpaths = !hasUsableSubpaths;

    // Exempt if any risk condition matches:
    if (isCJSOnly || hasCssSideEffects || noSubpaths) {
      results.add(name);
    }
  }

  return results;
}

// Build the dynamic EXEMPT_DEPS set once at config load:
const EXEMPT_DEPS: Set<string> = computeExemptDeps();

const config: NextConfig = {
  reactStrictMode: true,
  pageExtensions: ['ts', 'tsx'],
  poweredByHeader: false,
  compress: true,
  output: 'standalone',
  logging: {
    fetches: {
      fullUrl: true,
    },
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'mikeodnis.dev' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'github.com' },
      { protocol: 'https', hostname: 'api.lanyard.rest' },
      { protocol: 'https', hostname: 'i.scdn.co' },
      { protocol: 'https', hostname: 'cdn.discordapp.com' },
      { protocol: 'https', hostname: 'cdn.sanity.io' },
      { protocol: 'https', hostname: 'img.youtube.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'dev-to-uploads.s3.amazonaws.com' },
      { protocol: 'https', hostname: 'media.dev.to' },
      { protocol: 'https', hostname: 'media2.dev.to' },
      // Hashnode post covers (cdn.hashnode.com and the blog's generated /api/og/** title cards).
      ...HASHNODE_COVER_PATTERNS,
    ],
    imageSizes: [16, 20, 24, 32, 40],
    minimumCacheTTL: 60 * 60 * 24,
    formats: ['image/avif', 'image/webp'], // Modern image formats
    dangerouslyAllowSVG: false, // Prevent SVG XSS attacks
  },

  skipTrailingSlashRedirect: true,
  experimental: {
    optimizePackageImports: [
      ...(() => {
        try {
          const highPackages = require('./scripts/out/high.json');
          const mediumPackages = require('./scripts/out/medium.json');
          return Array.from(new Set([...highPackages, ...mediumPackages])).filter(
            (pkg) => !EXEMPT_DEPS.has(pkg),
          );
        } catch (error) {
          console.warn('Failed to load package optimization lists:', error);
          return [];
        }
      })(),
    ],
    optimizeCss: true,
    serverActions: {
      allowedOrigins: ['localhost:3000', process.env.NEXT_PUBLIC_APP_URL || ''],
      bodySizeLimit: '2mb',
    },
    webVitalsAttribution: ['CLS', 'LCP', 'TTFB', 'FCP', 'INP'],
    authInterrupts: true,
  },
  typedRoutes: false,
  typescript: {
    ignoreBuildErrors: false, // Don't ignore TypeScript errors in production
    tsconfigPath: './tsconfig.json',
  },

  async redirects() {
    return [
      {
        source: '/blog',
        destination: '/media',
        permanent: true,
      },
      {
        source: '/blog/:slug*',
        destination: '/media/:slug*',
        permanent: true,
      },
    ];
  },

  async rewrites() {
    return [
      { source: '/healthz', destination: '/api/health' },
      { source: '/api/healthz', destination: '/api/health' },
      { source: '/health', destination: '/api/health' },
      { source: '/ping', destination: '/api/health' },
    ];
  },

  async headers() {
    return [
      // Static security headers on every path. (The old page rule's source ended in '/', so it only
      // matched URLs with a trailing slash and normal pages never got these headers.) The
      // per-request CSP comes from src/proxy.ts.
      {
        source: SECURITY_HEADERS_SOURCE,
        headers: [...SECURITY_HEADERS],
      },
      // API responses: the CSP and CORP for JSON, then CORS and no-store. Elysia does not set
      // security headers, so these and the global rule above are the only source for /api.
      {
        source: API_SECURITY_HEADERS_SOURCE,
        headers: [
          ...API_SECURITY_HEADERS,
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.ALLOWED_ORIGIN || 'https://mikeodnis.dev',
          },
          { key: 'Access-Control-Allow-Methods', value: 'GET,DELETE,PATCH,POST,PUT,OPTIONS' },
          {
            key: 'Access-Control-Allow-Headers',
            value:
              'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
          },
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
        ],
      },
      // After the API rule, so it wins for /api/og: link-preview images are embedded cross-origin.
      {
        source: OG_IMAGE_HEADERS_SOURCE,
        headers: [...OG_IMAGE_HEADERS],
      },
      {
        source: '/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/:all*(svg|jpg|jpeg|png|gif|ico|webp|avif)',
        headers: [
          {
            key: 'Cache-control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/(.*).png',
        headers: [{ key: 'Content-Type', value: 'image/png' }],
      },
      // The script that retires the service worker older builds registered (public/sw.js). Kept
      // last so nothing above can override its Cache-Control.
      {
        source: RETIRED_SERVICE_WORKER_SOURCE,
        headers: [...RETIRED_SERVICE_WORKER_HEADERS],
      },
    ];
  },

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        child_process: false,
      };
    }

    config.module.rules.push({
      test: /\.(png|jpe?g|gif|svg|webp|avif)$/i,
      type: 'asset',
      generator: {
        filename: 'static/media/[hash][ext][query]',
      },
    });

    return config;
  },

  // Environment variable validation
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'https://mikeodnis.dev',
  },
};

const withBundleAnalyzerConfig = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const withMillion = MillionLint.next({
  rsc: true,
  filter: {
    include: '**/components/**/*.{mtsx,mjsx,tsx,jsx}',
    exclude: ['**/api/**/*.{ts,tsx}', '**/components/html/**/*.{ts,tsx}'],
  },
});

const combinedConfig = withMillion(withBundleAnalyzerConfig(config));

// Every production build is wrapped (tunnel, release and debug-ID injection); uploads and
// release creation additionally need the auth token. See src/config/sentry-build.ts.
const withSentry = (nextConfig: NextConfig): NextConfig =>
  shouldApplySentryConfig(process.env)
    ? withSentryConfig(nextConfig, buildSentryBuildOptions(process.env))
    : nextConfig;

export default withSentry(combinedConfig);
