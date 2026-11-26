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
 * @file Migration-only input: the ten bookshelf sections in shelf order, as the site's static
 * catalog defined them (formerly BOOK_TRACKS and DEFAULT_SHELVES in the bookshelf `_lib/books.ts`).
 * A shelf's title is its books' track label. The one-shot Sanity migration writes these as
 * `bookshelf` documents with order (i+1)*10; Sanity is the source of truth after it runs, and this
 * folder is deleted with the migration script.
 *
 * Self-contained on purpose: no imports from src/ or the '@/' alias, which `sanity exec` cannot
 * resolve, and nothing under src/ imports this, so it ships in no bundle.
 */

/** The shelf (track) titles, in shelf order: stages are numbered shelf by shelf in this order. */
export const CATALOG_TRACKS = [
  'Web & Languages',
  'Foundations',
  'Backend',
  'Infra & Ops',
  'Security',
  'AI',
  'Reasoning & Systems',
  'Mind & Society',
  'History & Economics',
  'Power & Institutions',
] as const;
export type CatalogTrack = (typeof CATALOG_TRACKS)[number];

/** One bookshelf section: its URL slug, its title (the track label) and its description. */
export interface CatalogShelf {
  readonly slug: string;
  readonly title: CatalogTrack;
  readonly description: string;
}

/** The ten shelves, in {@link CATALOG_TRACKS} order. */
export const CATALOG_SHELVES: readonly CatalogShelf[] = [
  {
    slug: 'web-and-languages',
    title: 'Web & Languages',
    description:
      'Python, JavaScript, jQuery, TypeScript, modern Angular, and full-stack web fundamentals.',
  },
  {
    slug: 'foundations',
    title: 'Foundations',
    description:
      'Computer science, math, linear algebra, hardware, kernels, concurrency, and how packets cross the wire.',
  },
  {
    slug: 'backend',
    title: 'Backend',
    description:
      'Clean architecture, design patterns, storage engines, replication, system design, and web scalability.',
  },
  {
    slug: 'infra-and-ops',
    title: 'Infra & Ops',
    description:
      'Containers, Kubernetes orchestration, Terraform IaC, SLOs, and production reliability.',
  },
  {
    slug: 'security',
    title: 'Security',
    description:
      'Kali Linux, offensive methodology, packet-level networking, and API security testing.',
  },
  {
    slug: 'ai',
    title: 'AI',
    description:
      'Machine learning, data science, deep learning, TinyML, edge AI, quantum ML, LLMs, and AI systems.',
  },
  {
    slug: 'reasoning-and-systems',
    title: 'Reasoning & Systems',
    description:
      'Philosophy, argument construction, statistical reasoning, systems thinking, and media ecology.',
  },
  {
    slug: 'mind-and-society',
    title: 'Mind & Society',
    description:
      'Psychology, cultural anthropology, and sociology—how individuals, norms, and groups shape behavior.',
  },
  {
    slug: 'history-and-economics',
    title: 'History & Economics',
    description:
      'World history, historical method, incentives, markets, and empirical development economics.',
  },
  {
    slug: 'power-and-institutions',
    title: 'Power & Institutions',
    description:
      'Political theory, state capacity, the rule of law, institutional legibility, and geopolitics.',
  },
];
