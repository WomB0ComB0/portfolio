import pwa, { type PluginOptions } from '@ducanh2912/next-pwa';
import MillionLint from '@million/lint';
import withBundleAnalyzer from '@next/bundle-analyzer';
import { type SentryBuildOptions, withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';
import './src/env';

// Just in case you accidentally import these packages
const EXEMPT_DEPS: Set<string> = new Set([
  'lucide-react',
  'date-fns',
  'lodash-es',
  'ramda',
  'antd',
  'react-bootstrap',
  'ahooks',
  '@ant-design/icons',
  '@headlessui/react',
  '@headlessui-float/react',
  '@heroicons/react/20/solid',
  '@heroicons/react/24/solid',
  '@heroicons/react/24/outline',
  '@visx/visx',
  '@tremor/react',
  'rxjs',
  '@mui/material',
  '@mui/icons-material',
  'recharts',
  'react-use',
  '@material-ui/core',
  '@material-ui/icons',
  '@tabler/icons-react',
  'mui-core',
  'react-icons/*',
]);

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
    formats: ['image/avif', 'image/webp'], // Modern image formats
    minimumCacheTTL: 60, // Cache images for 60 seconds minimum
    dangerouslyAllowSVG: false, // Prevent SVG XSS attacks
  },

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
  turbo: {
    resolveAlias: {
      '@/*': './src/*',
    },
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
      '**/*.{ts,tsx}': ['typescript'],
    },
  },
  typescript: {
    ignoreBuildErrors: false, // Don't ignore TypeScript errors in production
    tsconfigPath: './tsconfig.json',
  },

  eslint: {
    ignoreDuringBuilds: false, // Don't ignore ESLint errors in production
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
        source: '/((?!links|embed).*)',
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
            key: 'Cache-Control',
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

  publicRuntimeConfig: {
    basePath: '',
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
