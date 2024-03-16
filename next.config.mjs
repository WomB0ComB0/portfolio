await import("./src/env.js");

import million from 'million/compiler';
import * as pwa from '@ducanh2912/next-pwa';

const withPwa = pwa.default({
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  dest: 'public',
  fallbacks: {
    document: 'src/app/offline',
  },
  workboxOptions: {
    disableDevLogs: true,
  },
});

/**
 * Don't be scared of the generics here.
 * All they do is to give us autocompletion when using this.
 *
 * @template {import('next').NextConfig} T
 * @param {T} config - A generic parameter that flows through to the return type
 * @constraint {{import('next').NextConfig}}
 */
const config = {
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
};

// @ts-ignore
export default million.next(withPwa(config), { auto: { rsc: true } });
