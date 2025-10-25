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

import pwa, { type PluginOptions } from '@ducanh2912/next-pwa';
import MillionLint from '@million/lint';
import withBundleAnalyzer from '@next/bundle-analyzer';
import { type SentryBuildOptions, withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';
import './src/env';

// Just in case you accidentally import these packages
// next.config.ts (top-level, before config)
import fs from 'node:fs';
import path from 'node:path';

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
    // Add or remove as you learn more:
    '@mantine/modals',
    // Example placeholders; prune if they work fine in your app:
    // "@mantine/core",
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
      hasUsableSubpaths = false; // single entrypoint only
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

const withPwa = pwa({
  dest: 'public', // Output directory for the service worker and other PWA files
  disable: process.env.NODE_ENV === 'development', // Disable PWA in development mode
  register: true, // Automatically register the service worker
  dynamicStartUrl: true, // Enable dynamic start URL caching
  cacheOnFrontEndNav: true, // Enable caching for front-end navigation
  aggressiveFrontEndNavCaching: true, // Cache every `<link rel="stylesheet" />` and `<script />` on frontend navigation
  cacheStartUrl: true, // Cache the start URL
  reloadOnOnline: true, // Reload the app when it comes back online
  fallbacks: {
    image: '/assets/images/logo.webp', // Fallback route for images
    font: '/assets/fonts/Kodchasan-Regular.ttf', // Fallback route for fonts
  },
  workboxOptions: {
    exclude: [/\/_next\/static\/.*(?<!\.p)\.woff2/, /\.map$/, /^manifest.*\.js$/, /\.pdf$/], // Exclude specific files from precaching
    ignoreURLParametersMatching: [/^utm_/, /^fbclid$/], // Ignore specific URL parameters
    runtimeCaching: [
      {
        urlPattern: /\.(?:png|jpg|jpeg|svg|webp)$/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'images',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          },
        },
      },
      {
        urlPattern: /\.(?:js|css)$/,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'static-resources',
        },
      },
      {
        urlPattern: /\.(?:woff|woff2|eot|ttf|otf|pdf)$/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'fonts',
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
          },
        },
      },
      {
        urlPattern: /api\/.*/,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'api-responses',
          networkTimeoutSeconds: 10, // Fallback to cache if the network takes longer than 10 seconds
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 24 * 60 * 60, // 1 day
          },
        },
      },
    ],
  },
} satisfies PluginOptions);

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
    webVitalsAttribution: ['CLS', 'LCP', 'TTFB', 'FCP', 'FID'],
    authInterrupts: true,
  },
  typedRoutes: false,
  typescript: {
    ignoreBuildErrors: false, // Don't ignore TypeScript errors in production
    tsconfigPath: './tsconfig.json',
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
    const securityHeaders = [
      {
        key: 'X-DNS-Prefetch-Control',
        value: 'on',
      },
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
      },
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
      },
      {
        key: 'X-XSS-Protection',
        value: '1; mode=block',
      },
      {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin',
      },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=()',
      },
    ];

    const securityHeadersWithFrameProtection = [
      ...securityHeaders,
      {
        key: 'X-Frame-Options',
        value: 'SAMEORIGIN',
      },
    ];

    return [
      // Pages that need to embed external iframes (no X-Frame-Options)
      {
        source: '/embed/:path*',
        headers: securityHeaders, // No X-Frame-Options on embed pages
      },
      // All other pages get full security headers including X-Frame-Options
      {
        source: '/((?!links|embed).*)/',
        headers: securityHeadersWithFrameProtection,
      },
      {
        source: '/api/:path*',
        headers: [
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

    // Security: Disable source maps in production
    if (process.env.NODE_ENV === 'production') {
      config.devtool = false;
    }

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

const combinedConfig = withMillion(withBundleAnalyzerConfig(withPwa(config)));

/** @type {import('@sentry/nextjs').SentryBuildOptions} */
const sentryConfig = {
  org: process.env.SENTRY_ORG || 'womb0comb0',
  project: process.env.SENTRY_PROJECT || 'portfolio',
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: process.env.NODE_ENV !== 'development',

  release: {
    name: process.env.VERCEL_GIT_COMMIT_SHA || process.env.SENTRY_RELEASE || `local-${Date.now()}`,
    create: true,
    setCommits: {
      auto: true,
      ignoreMissing: true,
      ignoreEmpty: true,
    },
  },

  sourcemaps: {
    assets: ['.next/**/*.js', '.next/**/*.map'],
    ignore: ['node_modules/**/*', '.next/cache/**/*'],
    deleteSourcemapsAfterUpload: true,
  },

  widenClientFileUpload: true,
  autoInstrumentServerFunctions: true,
  autoInstrumentMiddleware: true,
  autoInstrumentAppDirectory: true,
  tunnelRoute: '/monitoring',
  disableLogger: true,
  automaticVercelMonitors: true,

  reactComponentAnnotation: {
    enabled: true,
  },

  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeReplayShadowDom: true,
    excludeReplayIframe: true,
    excludeReplayWorker: true,
  },
} satisfies SentryBuildOptions;

const withSentry =
  process.env.NODE_ENV === 'production' && process.env.SENTRY_AUTH_TOKEN
    ? (config: any) => withSentryConfig(config, sentryConfig)
    : (config: any) => config;

export default withSentry(combinedConfig);
