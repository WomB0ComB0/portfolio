import million from 'million/compiler';
import * as pwa from '@ducanh2912/next-pwa';

const withPwa = pwa.default({
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  swcMinify: true,
  dest: 'public',
  fallbacks: {
    document: 'src/app/offline',
  },
  workboxOptions: {
    disableDevLogs: true,
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    dirs: ['.'],
  },
  reactStrictMode: true,
  compiler: {
    removeConsole: false,
  },
  images: {
    domains: ['images.g2crowd.com', 'cdn.jsdelivr.net'],
  },
};

export default million.next(withPwa(nextConfig), { auto: { rsc: true } });
