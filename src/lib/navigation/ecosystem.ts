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

import type { Action } from 'kbar';
import { createElement } from 'react';
import type { IconType } from 'react-icons';
import {
  FiActivity,
  FiBriefcase,
  FiCloud,
  FiCode,
  FiCpu,
  FiFileText,
  FiHeart,
  FiHome,
  FiLink2,
  FiRss,
} from 'react-icons/fi';

/** Section label for the *.mikeodnis.dev network properties. */
export const ECOSYSTEM_SECTION = '*.mikeodnis.dev';

/** Section label for independent ventures and studios. */
export const VENTURES_SECTION = 'Ventures';

const ACTION_ICON_SIZE = 18;

export interface EcosystemSite {
  readonly id: string;
  readonly name: string;
  readonly host: string;
  readonly url: string;
  readonly description: string;
  readonly keywords: string;
  readonly icon: IconType;
  readonly group: 'network' | 'ventures';
  /** Present when this property is the current site (mikeodnis.dev). */
  readonly current?: boolean;
  /** Internal route on this site when the entry points to a local page. */
  readonly internalPath?: string;
}

/**
 * Full *.mikeodnis.dev network and ventures constellation, aligned with companion properties
 * such as links.mikeodnis.dev so switching between apps feels seamless.
 */
export const ECOSYSTEM_SITES: readonly EcosystemSite[] = [
  {
    id: 'ecosystem-portfolio',
    name: 'Portfolio',
    host: 'mikeodnis.dev',
    url: 'https://mikeodnis.dev',
    description: 'Live Console hub, projects, and telemetry',
    keywords: 'portfolio home mikeodnis.dev',
    icon: FiHome,
    group: 'network',
    current: true,
    internalPath: '/',
  },
  {
    id: 'ecosystem-links',
    name: 'Links',
    host: 'links.mikeodnis.dev',
    url: 'https://links.mikeodnis.dev',
    description: 'Verified short links and click analytics',
    keywords: 'links shortener url redirect links.mikeodnis.dev',
    icon: FiLink2,
    group: 'network',
  },
  {
    id: 'ecosystem-blog',
    name: 'Blog',
    host: 'blog.mikeodnis.dev',
    url: 'https://blog.mikeodnis.dev',
    description: 'Writing and engineering notes',
    keywords: 'blog articles writing hashnode blog.mikeodnis.dev',
    icon: FiFileText,
    group: 'network',
  },
  {
    id: 'ecosystem-news',
    name: 'News',
    host: 'news.mikeodnis.dev',
    url: 'https://news.mikeodnis.dev',
    description: 'Curated tech feed and dispatches',
    keywords: 'news feed updates news.mikeodnis.dev',
    icon: FiRss,
    group: 'network',
  },
  {
    id: 'ecosystem-api',
    name: 'API',
    host: 'api.mikeodnis.dev',
    url: 'https://api.mikeodnis.dev',
    description: 'Shared platform API gateway',
    keywords: 'api endpoints developer api.mikeodnis.dev',
    icon: FiCpu,
    group: 'network',
  },
  {
    id: 'ecosystem-cdn',
    name: 'CDN',
    host: 'cdn.mikeodnis.dev',
    url: 'https://cdn.mikeodnis.dev',
    description: 'Static media and asset delivery',
    keywords: 'cdn assets static files cdn.mikeodnis.dev',
    icon: FiCloud,
    group: 'network',
  },
  {
    id: 'ecosystem-status',
    name: 'Status',
    host: 'status.mikeodnis.dev',
    url: 'https://status.mikeodnis.dev',
    description: 'Live uptime and service health',
    keywords: 'status uptime monitoring health status.mikeodnis.dev',
    icon: FiActivity,
    group: 'network',
  },
  {
    id: 'ecosystem-sponsor',
    name: 'Sponsor',
    host: 'mikeodnis.dev/sponsor',
    url: 'https://mikeodnis.dev/sponsor',
    description: 'Support open-source engineering',
    keywords: 'sponsor support github open source',
    icon: FiHeart,
    group: 'network',
    internalPath: '/sponsor',
  },
  {
    id: 'ecosystem-oss',
    name: 'Elysium Tools',
    host: 'elysium.tools',
    url: 'https://elysium.tools',
    description: 'Open-source developer tooling',
    keywords: 'oss open source elysium tools elysium.tools',
    icon: FiCode,
    group: 'ventures',
  },
  {
    id: 'ecosystem-freelance',
    name: 'Atroviola',
    host: 'atroviola.com',
    url: 'https://atroviola.com',
    description: 'Freelance engineering and studio',
    keywords: 'freelance consulting studio atroviola atroviola.com',
    icon: FiBriefcase,
    group: 'ventures',
  },
];

export const NETWORK_ECOSYSTEM_SITES: readonly EcosystemSite[] = ECOSYSTEM_SITES.filter(
  (site) => site.group === 'network',
);

export const EXTERNAL_NETWORK_SITES: readonly EcosystemSite[] = NETWORK_ECOSYSTEM_SITES.filter(
  (site) => !site.internalPath,
);

export const VENTURE_ECOSYSTEM_SITES: readonly EcosystemSite[] = ECOSYSTEM_SITES.filter(
  (site) => site.group === 'ventures',
);

/**
 * Registers external companion *.mikeodnis.dev subdomains and ventures in the command palette.
 * Local routes (Home and Sponsor) are already registered by createNavigationActions.
 */
export const createEcosystemActions = (): Action[] =>
  ECOSYSTEM_SITES.filter((site) => !site.internalPath).map(
    ({ id, name, host, url, description, keywords, icon, group }) => ({
      id,
      name,
      subtitle: `${host} · ${description}`,
      keywords,
      section: group === 'ventures' ? VENTURES_SECTION : ECOSYSTEM_SECTION,
      icon: createElement(icon, { size: ACTION_ICON_SIZE, 'aria-hidden': true }),
      perform: () => {
        window.open(url, '_blank', 'noopener,noreferrer');
      },
    }),
  );
