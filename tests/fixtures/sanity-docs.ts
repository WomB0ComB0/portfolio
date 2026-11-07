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
 * @file Sanity document factories for tests. Each returns a document that decodes with its schema
 * in '@/hooks/sanity/schemas', so it works both as what Sanity answers (mock the client with it)
 * and as what a loader returns (mock '@/lib/sanity/loaders' with it). Every document gets a unique
 * `_id` and its own ISO timestamps; pass overrides for the fields a test is about.
 */

import type {
  Article,
  Certification,
  Experience,
  Place,
  Presentation,
  Project,
  Resume,
  Talk,
} from '@/hooks/sanity/schemas';
import type { ListedVideo } from '@/lib/sanity/loaders';

/** The first document's timestamp; each later document is one minute newer. */
const FIXTURE_EPOCH_MS = Date.UTC(2026, 0, 1);
const MINUTE_MS = 60_000;

/** Counts documents across the test run, so ids never repeat. */
let documentCount = 0;

interface DocumentMeta {
  readonly _id: string;
  readonly _createdAt: string;
  readonly _updatedAt: string;
  readonly _rev: string;
}

/** The next document's number and system fields, e.g. `{ _id: 'project-3', ... }`. */
function nextDocument(prefix: string): { readonly n: number; readonly meta: DocumentMeta } {
  documentCount += 1;
  const n = documentCount;
  const at = new Date(FIXTURE_EPOCH_MS + n * MINUTE_MS).toISOString();
  return { n, meta: { _id: `${prefix}-${n}`, _createdAt: at, _updatedAt: at, _rev: `rev-${n}` } };
}

export function makeProject(overrides: Partial<Project> = {}): Project {
  const { n, meta } = nextDocument('project');
  return {
    ...meta,
    _type: 'project',
    title: `Project ${n}`,
    slug: { _type: 'slug', current: `project-${n}` },
    description: `What project ${n} does.`,
    category: 'Web Development',
    technologies: ['TypeScript', 'React'],
    status: 'Completed',
    featured: false,
    order: n,
    ...overrides,
  };
}

export function makeExperience(overrides: Partial<Experience> = {}): Experience {
  const { n, meta } = nextDocument('experience');
  return {
    ...meta,
    _type: 'experience',
    position: `Software Engineer ${n}`,
    company: `Company ${n}`,
    description: `What the role at company ${n} involved.`,
    technologies: ['TypeScript'],
    startDate: '2024-01-01',
    endDate: '2025-01-01',
    current: false,
    order: n,
    ...overrides,
  };
}

export function makeCertification(overrides: Partial<Certification> = {}): Certification {
  const { n, meta } = nextDocument('certification');
  return {
    ...meta,
    _type: 'certification',
    title: `Certification ${n}`,
    issuer: `Issuer ${n}`,
    issueDate: '2025-01-15',
    order: n,
    featured: false,
    ...overrides,
  };
}

export function makePlace(overrides: Partial<Place> = {}): Place {
  const { n, meta } = nextDocument('place');
  return {
    ...meta,
    _type: 'place',
    name: `Place ${n}`,
    description: `What happened at place ${n}.`,
    category: 'Conference',
    latitude: 40.7128,
    longitude: -74.006,
    startDate: '2026-05-19',
    order: n,
    featured: false,
    ...overrides,
  };
}

export function makeResume(overrides: Partial<Resume> = {}): Resume {
  const { n, meta } = nextDocument('resume');
  return {
    ...meta,
    _type: 'resume',
    title: `Resume ${n}`,
    pdfFile: { _type: 'file', asset: { _ref: `file-resume${n}-pdf`, _type: 'reference' } },
    lastUpdated: '2026-10-01',
    isActive: true,
    ...overrides,
  };
}

export function makePresentation(overrides: Partial<Presentation> = {}): Presentation {
  const { n, meta } = nextDocument('presentation');
  return {
    ...meta,
    _type: 'presentation',
    title: `Presentation ${n}`,
    description: `What presentation ${n} covers.`,
    eventName: `Event ${n}`,
    date: '2025-03-01',
    order: n,
    ...overrides,
  };
}

export function makeTalk(overrides: Partial<Talk> = {}): Talk {
  const { n, meta } = nextDocument('talk');
  return {
    ...meta,
    _type: 'talk',
    title: `Talk ${n}`,
    description: `What talk ${n} covers.`,
    venue: `Venue ${n}`,
    date: '2025-04-01',
    order: n,
    ...overrides,
  };
}

export function makeArticle(overrides: Partial<Article> = {}): Article {
  const { n, meta } = nextDocument('article');
  return {
    ...meta,
    _type: 'article',
    title: `Article ${n}`,
    excerpt: `What article ${n} is about.`,
    publication: `Publication ${n}`,
    publicationUrl: `https://example.com/articles/${n}`,
    publishedDate: '2025-06-01',
    order: n,
    ...overrides,
  };
}

/** A video as '/api/v1/sanity/videos' and loadVideos() list it: a Sanity video by default. */
export function makeVideo(overrides: Partial<ListedVideo> = {}): ListedVideo {
  const { n, meta } = nextDocument('video');
  return {
    ...meta,
    _type: 'youtubeVideo',
    title: `Video ${n}`,
    description: `What video ${n} shows.`,
    videoId: `video${String(n).padStart(6, '0')}`,
    publishedDate: meta._createdAt,
    order: n,
    source: 'sanity',
    ...overrides,
  };
}
