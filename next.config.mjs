import pwa from '@ducanh2912/next-pwa';
import MillionLint from '@million/lint';
import withBundleAnalyzer from '@next/bundle-analyzer';
import { withSentryConfig } from '@sentry/nextjs';

const withPwa = pwa({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  sw: '/sw.js',
  publicExcludes: ['!noprecache/**/*'],
});

/**
 * @type {import('next').NextConfig}
 */
const config = {
  reactStrictMode: true,
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
      { protocol: 'https', hostname: 'linktr.ee' },
      { protocol: 'https', hostname: 'docs.google.com' },
    ],
  },
  experimental: {
    optimizeCss: true,
    // swcMinify: true,
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },
  typescript: {
    ignoreBuildErrors: true,
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
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: 'https://mikeodnis.dev' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,DELETE,PATCH,POST,PUT' },
          {
            key: 'Access-Control-Allow-Headers',
            value:
              'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version',
          },
          {
            key: 'Cache-Control',
            value: 'no-cache, must-revalidate, max-age=0',
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
  publicRuntimeConfig: {
    basePath: '',
  },
};

const withBundleAnalyzerConfig = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const withMillion = MillionLint.next({
  rsc: true,
  filter: {
    exclude: './src/components/Guestbook.tsx',
    include: '**/components/*.{mtsx,mjsx,tsx,jsx}',
  },
});

const combinedConfig = withMillion(withBundleAnalyzerConfig(withPwa(config)));

/** @type {import('@sentry/nextjs').SentryBuildOptions} */
const sentryConfig = {
  org: 'womb0comb0',
  project: 'portfolio',
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: process.env.NODE_ENV === 'production',
  release: {
    name: process.env.VERCEL_GIT_COMMIT_SHA || `local-${Date.now()}`,
    create: true,
    setCommits: {
      auto: true,
      ignoreMissing: true,
      ignoreEmpty: true
    },
  },
  sourcemaps: {
    assets: './**/*.{js,map}',
    ignore: ['node_modules/**/*'],
    deleteSourcemapsAfterUpload: true
  },
  // hideSourceMaps: true,
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
  }
};

const withSentry =
  process.env.NODE_ENV === 'production'
    ?
    (
      /** @type {import('next').NextConfig} */
      config
    ) => withSentryConfig(
      config,
      sentryConfig
    )
    :
    (
      /** @type {import('next').NextConfig} */
      config
    ) => config;

export default withSentry(combinedConfig);
