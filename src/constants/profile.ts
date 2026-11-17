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
 * Public identity shared by server HTML, client chrome and metadata. No imports, I/O or
 * environment access: changing these values takes one deploy, never a runtime CMS request.
 * Location and the home tagline override remain optional Studio content.
 */
const name = 'Mike Odnis';
const email = 'mike@mikeodnis.dev';
const githubUsername = 'WomB0ComB0';
const xUsername = 'mike_odnis';
const youtubeHandle = '@mikeodnis';

export const profile = {
  name,
  email,
  emailHref: `mailto:${email.replaceAll('%', '%25')}`,
  tagline: 'Building web software end to end.',
  description: `${name} is a software engineer building web software end to end: projects, experience, certifications, places and live stats.`,
  siteHost: 'mikeodnis.dev',
  avatar: {
    src: 'https://avatars.githubusercontent.com/u/95197809?v=4',
    alt: `${name}'s avatar: a painting of a scholar writing at his desk`,
  },
  github: { username: githubUsername, url: `https://github.com/${githubUsername}` },
  linkedinUrl: 'https://www.linkedin.com/in/mikeodnis/',
  x: { handle: `@${xUsername}`, url: `https://x.com/${xUsername}` },
  youtube: { handle: youtubeHandle, url: `https://www.youtube.com/${youtubeHandle}` },
  blueskyUrl: 'https://bsky.app/profile/mikeodnis.dev',
  instagramUrl: 'https://instagram.com/mikeodnis.dev',
  blogUrl: 'https://blog.mikeodnis.dev',
  newsletterUrl: 'https://news.mikeodnis.dev',
} as const;
