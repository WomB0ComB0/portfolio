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
 * @file A synthetic filter page for the filter tests: five projects shaped like /projects rows,
 * and their schema (a single-select kind with old free-text categories still resolving, and a
 * multi-select technology folded by techKey). Not a test file itself.
 */

import { defineFilters } from '@/lib/filters';

export interface Project {
  readonly id: string;
  readonly title: string;
  readonly kind: string;
  readonly techs: readonly string[];
}

export const PROJECTS: readonly Project[] = [
  { id: 'a', title: 'Alpha CLI', kind: 'tools', techs: ['go', 'cobra'] },
  { id: 'b', title: 'Beta app', kind: 'apps', techs: ['react', 'typescript'] },
  { id: 'c', title: 'Gamma hack', kind: 'hackathons', techs: ['react', 'python'] },
  { id: 'd', title: 'Delta site', kind: 'websites', techs: ['react', 'typescript', 'tailwind'] },
  { id: 'e', title: 'Epsilon bot', kind: 'tools', techs: ['python'] },
];

const KIND_LABELS: Readonly<Record<string, string>> = {
  tools: 'Tools',
  apps: 'Apps',
  hackathons: 'Hackathons',
  websites: 'Websites',
};
const TECH_LABELS: Readonly<Record<string, string>> = {
  go: 'Go',
  cobra: 'Cobra',
  react: 'React',
  typescript: 'TypeScript',
  python: 'Python',
  tailwind: 'Tailwind CSS',
};
/** The old free-text categories a shared link may still carry. */
const LEGACY_KIND: Readonly<Record<string, string>> = {
  'CLI Tool / Python / File Management': 'tools',
  'Web Development (Elysium Freelance)': 'websites',
};
const TECH_KEYS: Readonly<Record<string, string>> = {
  react: 'react',
  reactjs: 'react',
  typescript: 'typescript',
  go: 'go',
  python: 'python',
  cobra: 'cobra',
  tailwind: 'tailwind',
  tailwindcss: 'tailwind',
};

/** A record's own value for `key`, or null (never one from Object.prototype). */
const own = (record: Readonly<Record<string, string>>, key: string): string | null =>
  Object.hasOwn(record, key) ? (record[key] ?? null) : null;
const techKey = (raw: string): string | null =>
  own(TECH_KEYS, raw.toLowerCase().replaceAll(/[^a-z0-9]+/g, ''));
/** ?category as a kind: today's slug, an old free-text category's kind, or null to drop it. */
const kindOf = (raw: string): string | null =>
  Object.hasOwn(KIND_LABELS, raw) ? raw : own(LEGACY_KIND, raw);

export const projects = defineFilters<Project, 'category' | 'tech'>({
  path: '/projects',
  noun: { one: 'project', many: 'projects' },
  search: { haystack: (p) => `${p.title} ${p.techs.join(' ')}`, maxLength: 40 },
  facets: {
    category: {
      label: 'Kind',
      valuesOf: (p) => [p.kind],
      /** A kind's label, else the slug. */
      labelOf: (slug) => KIND_LABELS[slug] ?? slug,
      values: ['tools', 'apps', 'hackathons', 'websites'],
      resolve: kindOf,
      scope: (labels) => `in ${labels.join(' or ')}`,
    },
    tech: {
      label: 'Technology',
      multiple: true,
      valuesOf: (p) => p.techs,
      /** A technology's label, else the slug. */
      labelOf: (slug) => TECH_LABELS[slug] ?? slug,
      resolve: techKey,
      scope: (labels) => `with ${labels.join(' or ')}`,
    },
  },
});
