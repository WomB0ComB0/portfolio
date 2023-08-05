/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    domains: ['images.g2crowd.com', 'cdn.jsdelivr.net'],
  },
}
// const withPWA = require('next-pwa')
// module.exports = withPWA({
//   reactStrictMode: true,
//   pwa: {
//     dest: "public",
//     register: true,
//     skipWaiting: true,
//     disable: process.env.NODE_ENV === 'development',
//   }
// });
module.exports = nextConfig 