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
 * @file Which project a /media item is about (media-projects.ts). The page says so by itself only
 * on evidence: the item's own description links the project's repository or live address. Most
 * cases here are look-alikes that must stay unrelated: a generic word shared by two titles, a
 * project named like an ordinary word, a line every upload repeats, a profile or a longer
 * address. The hand-written map (media-project-links.ts) covers the rest, and its proposals show
 * only where asked for (the lab). Synthetic data only.
 */

import { makeVideo } from '@tests/fixtures/sanity-docs';
import { describe, expect, it } from 'vitest';
import {
  buildFeed,
  type FeedEntry,
  type FeedSources,
} from '@/app/(routes)/(dev)/media/_lib/media-feed';
import {
  MEDIA_NOT_PROJECTS,
  MEDIA_PROJECT_RULES,
  MEDIA_PROJECTS,
} from '@/app/(routes)/(dev)/media/_lib/media-project-links';
import {
  distinctiveName,
  PROJECT_FAN_MAX,
  type ProjectRef,
  type ProjectRules,
  projectSignals,
  proposedProjects,
  relateProjects,
  titleNamesProject,
} from '@/app/(routes)/(dev)/media/_lib/media-projects';
import type { Blog } from '@/app/api/v1/[[...route]]/blog/handlers';
import { SITE_HOST } from '@/lib/og/constants';

const NO_RULES: ProjectRules = { links: [], notLinks: [] };
const noImages = (): string | null => null;

const DECODER: ProjectRef = {
  id: 'decoder',
  title: 'Product Decoder',
  githubUrl: 'https://github.com/Example/product-decoder',
  liveUrl: null,
};
const SPARK: ProjectRef = {
  id: 'spark',
  title: 'SparkMind - AI-Driven Personalized Learning Hub',
  githubUrl: 'https://github.com/someone/sparkmind',
  liveUrl: 'https://sparkmind.example.app',
};
const SITE: ProjectRef = {
  id: 'site',
  title: 'example.dev – Personal Portfolio',
  githubUrl: 'https://github.com/Example/portfolio',
  liveUrl: 'https://example.dev',
};
const SHORTENER: ProjectRef = {
  id: 'short',
  title: 'LinkShort',
  githubUrl: null,
  liveUrl: 'https://links.example.dev',
};
const ORG: ProjectRef = {
  id: 'org',
  title: 'ExampleOSS',
  githubUrl: 'https://github.com/ExampleOSS',
  liveUrl: null,
};
const SYNAPSE: ProjectRef = {
  id: 'synapse',
  title: 'synapse',
  githubUrl: 'https://github.com/Example/synapse',
  liveUrl: null,
};
const PROJECTS = [DECODER, SPARK, SITE, SHORTENER, ORG, SYNAPSE];

/** A made video with an 11-character id built from `name`. */
const video = (name: string, overrides: Parameters<typeof makeVideo>[0] = {}) =>
  makeVideo({
    _id: name,
    videoId: name.padEnd(11, '0').slice(0, 11),
    title: `Video ${name}`,
    description: '',
    publishedDate: '2025-04-01T00:00:00Z',
    ...overrides,
  });

const watch = (name: string): string =>
  `https://www.youtube.com/watch?v=${name.padEnd(11, '0').slice(0, 11)}`;

const post = (slug: string, overrides: Partial<Blog> = {}): Blog => ({
  title: `Post ${slug}`,
  slug,
  publishedAt: '2025-03-01T00:00:00.000Z',
  excerpt: '',
  source: 'hashnode',
  url: `https://blog.example.dev/${slug}`,
  ...overrides,
});

/** The feed for `sources`, each entry related to its project by the page's own rules. */
function related(
  sources: Partial<FeedSources>,
  rules: ProjectRules = NO_RULES,
  projects: readonly ProjectRef[] = PROJECTS,
): FeedEntry[] {
  return relateProjects(buildFeed(sources, noImages), projectSignals(sources), projects, rules);
}

/** "kind:source id" to the project id, for the entries that have a project. */
const projectsOf = (entries: readonly FeedEntry[]): Record<string, string> =>
  Object.fromEntries(
    entries
      .filter((entry) => entry.project !== null)
      .map((entry) => [entry.id, entry.project?.id ?? '']),
  );

describe('an item whose description links the project', () => {
  it('relates a video that links the repository, carrying the project as it is', () => {
    const entries = related({
      videos: [
        video('overview', {
          description: 'Resources:\n- https://github.com/Example/product-decoder',
        }),
      ],
    });

    expect(entries[0]?.project).toEqual({
      id: 'decoder',
      title: 'Product Decoder',
      proposed: false,
    });
  });

  it.each([
    ['a page inside the repository', 'https://github.com/Example/product-decoder/tree/main/apps'],
    ['an issue of it', 'https://github.com/Example/product-decoder/issues/12'],
    ['.git and another case', 'https://github.com/example/Product-Decoder.git'],
    ['www., a trailing slash, a full stop', 'See https://www.github.com/Example/product-decoder/.'],
    ['a query string', 'https://github.com/Example/product-decoder?tab=readme-ov-file'],
  ])('still relates with %s', (_what, description) => {
    expect(projectsOf(related({ videos: [video('v', { description })] }))).toEqual({
      'video:v': 'decoder',
    });
  });

  it('relates on the live address, exactly', () => {
    const entries = related({
      videos: [video('demo', { description: 'Try it: https://sparkmind.example.app/' })],
    });

    expect(projectsOf(entries)).toEqual({ 'video:demo': 'spark' });
  });

  it('reads a post by the links in its excerpt', () => {
    const entries = related({
      posts: [post('how', { excerpt: 'The code: https://github.com/someone/sparkmind' })],
    });

    expect(projectsOf(entries)).toEqual({ 'post:https://blog.example.dev/how': 'spark' });
  });

  it('adds the project to what a search reads', () => {
    const [entry] = related({
      videos: [video('v', { description: 'https://github.com/Example/product-decoder' })],
    });

    expect(entry?.haystack).toContain('Product Decoder');
  });
});

describe('look-alikes that relate nothing', () => {
  it.each([
    ["the owner's profile, not the repository", 'GitHub: https://github.com/Example'],
    ['another repository of the same owner', 'https://github.com/Example/product-decoder-old'],
    ['the same repository name under another owner', 'https://github.com/other/product-decoder'],
    ['a page under a live address (a short link)', 'https://links.example.dev/abc123'],
    ['a repository of an organisation that is a project', 'https://github.com/ExampleOSS/tool'],
    ['a share link that only carries the address', 'https://x.example/?u=https://example.dev'],
    ['the address as plain words', 'github.com/Example/product-decoder'],
    ['no link at all', 'Product Decoder, an overview.'],
  ])('%s', (_what, description) => {
    expect(projectsOf(related({ videos: [video('v', { description })] }))).toEqual({});
  });

  it('a generic word two titles share is no evidence', () => {
    const entries = related({
      videos: [video('tips', { title: 'Portfolio tips', description: 'Five portfolio tips.' })],
      posts: [post('portfolio', { title: 'My portfolio, rebuilt' })],
    });

    expect(projectsOf(entries)).toEqual({});
    expect(titleNamesProject('Portfolio tips', SITE.title)).toBe(false);
  });

  it('a project named like an ordinary word is never read off a title or a description', () => {
    const entries = related({
      videos: [
        video('brain', {
          title: 'How a synapse fires',
          description: 'A synapse is the gap between two neurons.',
        }),
      ],
    });

    expect(projectsOf(entries)).toEqual({});
    expect(distinctiveName(SYNAPSE.title)).toBeNull();
    expect(titleNamesProject('How a synapse fires', SYNAPSE.title)).toBe(false);
  });

  it('a line every upload repeats is a template, not a statement about one upload', () => {
    const videos = Array.from({ length: PROJECT_FAN_MAX + 1 }, (_, n) =>
      video(`tpl${n}`, { description: 'Follow me\n- Website: https://example.dev' }),
    );

    expect(projectsOf(related({ videos }))).toEqual({});
  });

  it(`still relates when ${PROJECT_FAN_MAX} items link one project (a short series)`, () => {
    const videos = Array.from({ length: PROJECT_FAN_MAX }, (_, n) =>
      video(`log${n}`, { description: 'https://github.com/Example/product-decoder' }),
    );

    expect(Object.values(projectsOf(related({ videos })))).toEqual(
      Array.from({ length: PROJECT_FAN_MAX }, () => 'decoder'),
    );
  });

  it('a template line does not hide the one real link beside it', () => {
    const videos = [
      ...Array.from({ length: PROJECT_FAN_MAX + 1 }, (_, n) =>
        video(`tpl${n}`, { description: 'Website: https://example.dev' }),
      ),
      video('real', {
        description: 'Website: https://example.dev\nhttps://github.com/Example/product-decoder',
      }),
    ];

    expect(projectsOf(related({ videos }))).toEqual({ 'video:real': 'decoder' });
  });

  it('an item that links two projects is about neither', () => {
    const entries = related({
      videos: [
        video('roundup', {
          description: 'https://github.com/Example/product-decoder https://sparkmind.example.app',
        }),
      ],
    });

    expect(projectsOf(entries)).toEqual({});
  });

  it('an address two projects share names neither', () => {
    const twin: ProjectRef = { ...DECODER, id: 'twin', title: 'Decoder, again' };
    const entries = related(
      { videos: [video('v', { description: 'https://github.com/Example/product-decoder' })] },
      NO_RULES,
      [DECODER, twin],
    );

    expect(projectsOf(entries)).toEqual({});
  });
});

describe("the site's own address", () => {
  // SITE's live address is the site these rows are shown on: any upload may list it.
  const rules: ProjectRules = { ...NO_RULES, siteHost: 'example.dev' };
  const listsTheSite = (name: string) =>
    video(name, { description: 'Resources Mentioned in the Video:\n- https://example.dev' });

  it('relates nothing by itself, however it is written', () => {
    const entries = related(
      {
        videos: [
          listsTheSite('revamp'),
          video('other', { description: 'My site: https://www.EXAMPLE.dev/' }),
        ],
      },
      rules,
    );

    expect(projectsOf(entries)).toEqual({});
  });

  it("still relates on the site's repository", () => {
    const entries = related(
      {
        videos: [video('code', { description: 'The code: https://github.com/Example/portfolio' })],
      },
      rules,
    );

    expect(projectsOf(entries)).toEqual({ 'video:code': 'site' });
  });

  // A project that lives on a subdomain of the site is listed among the owner's links just as
  // the site is, so its address says no more about one upload: the map states such a relation.
  it('reads no live address on a subdomain of the site either', () => {
    const shortener = video('short', { description: 'Shortened with https://links.example.dev' });
    const stated: ProjectRules = { ...rules, links: [{ item: watch('short'), project: 'short' }] };

    expect(projectsOf(related({ videos: [shortener] }, rules))).toEqual({});
    expect(projectsOf(related({ videos: [shortener] }, stated))).toEqual({
      'video:short': 'short',
    });
    // A host that only ends in the same letters is another site.
    const lookalike = video('look', { description: 'https://notexample.dev' });
    const projects = [{ id: 'look', title: 'Look', liveUrl: 'https://notexample.dev' }];
    expect(projectsOf(related({ videos: [lookalike] }, rules, projects))).toEqual({
      'video:look': 'look',
    });
  });

  it('keeps a relation the map states, however many other items list the site', () => {
    const others = ['a', 'b', 'c', 'd'].map(listsTheSite);
    const stated: ProjectRules = { ...rules, links: [{ item: watch('revamp'), project: 'site' }] };

    for (const count of [0, 1, others.length]) {
      const entries = related(
        { videos: [listsTheSite('revamp'), ...others.slice(0, count)] },
        stated,
      );

      expect(projectsOf(entries)).toEqual({ 'video:revamp': 'site' });
    }
  });

  it('reads every live address when no site host is given', () => {
    const entries = related({ videos: [listsTheSite('revamp')] });

    expect(projectsOf(entries)).toEqual({ 'video:revamp': 'site' });
  });
});

describe('the map', () => {
  it('relates an item nothing links, by its YouTube address, bare id or post address', () => {
    const entries = related(
      { videos: [video('demo'), video('other')], posts: [post('notes')] },
      {
        links: [
          { item: watch('demo'), project: 'spark' },
          { item: 'other000000', project: 'decoder' },
          { item: 'https://www.blog.example.dev/notes/', project: 'site' },
        ],
        notLinks: [],
      },
    );

    expect(projectsOf(entries)).toEqual({
      'video:demo': 'spark',
      'video:other': 'decoder',
      'post:https://blog.example.dev/notes': 'site',
    });
  });

  it('a confirmed rule wins over a link to another project', () => {
    const entries = related(
      { videos: [video('v', { description: 'https://github.com/Example/product-decoder' })] },
      { links: [{ item: watch('v'), project: 'spark' }], notLinks: [] },
    );

    expect(projectsOf(entries)).toEqual({ 'video:v': 'spark' });
  });

  it('a rule for a project that is not published, or that cannot be read, relates nothing', () => {
    const entries = related(
      { videos: [video('v')] },
      {
        links: [
          { item: watch('v'), project: 'gone' },
          { item: 'not an address', project: 'decoder' },
        ],
        notLinks: [],
      },
    );

    expect(projectsOf(entries)).toEqual({});
  });

  it('the block list stops a link and a rule for that item and project only', () => {
    const sources = {
      videos: [
        video('v', { description: 'https://github.com/Example/product-decoder' }),
        video('w', { description: 'https://github.com/Example/product-decoder' }),
      ],
    };
    const blocked = related(sources, {
      links: [{ item: watch('v'), project: 'decoder' }],
      notLinks: [{ item: watch('v'), project: 'decoder' }],
    });

    expect(projectsOf(blocked)).toEqual({ 'video:w': 'decoder' });
  });

  it('never shows a proposal on the page itself', () => {
    const entries = related(
      { videos: [video('demo', { title: 'SparkMind, a demo' })] },
      { links: [{ item: watch('demo'), project: 'spark', proposed: true }], notLinks: [] },
    );

    expect(projectsOf(entries)).toEqual({});
  });
});

describe('proposals (the lab)', () => {
  const rules: ProjectRules = {
    links: [
      { item: watch('demo'), project: 'spark', proposed: true },
      { item: watch('tips'), project: 'site', proposed: true },
      { item: watch('brain'), project: 'synapse', proposed: true },
      { item: watch('linked'), project: 'spark', proposed: true },
    ],
    notLinks: [],
  };
  const sources = {
    videos: [
      video('demo', { title: 'Sparkmind - Calendar scope check' }),
      video('tips', { title: 'Portfolio tips' }),
      video('brain', { title: 'How a synapse fires' }),
      video('linked', {
        title: 'SparkMind and Product Decoder',
        description: 'https://github.com/Example/product-decoder',
      }),
    ],
  };

  it("keeps a proposal only where the title holds the project's distinctive name", () => {
    const entries = related(sources, rules);

    expect(proposedProjects(entries, PROJECTS, rules)).toEqual([
      {
        entryId: 'video:demo',
        project: {
          id: 'spark',
          title: 'SparkMind - AI-Driven Personalized Learning Hub',
          proposed: true,
        },
      },
    ]);
  });

  it('proposes nothing for an item the page already relates, or one on the block list', () => {
    const entries = related(sources, rules);
    const proposals = proposedProjects(entries, PROJECTS, {
      ...rules,
      notLinks: [{ item: watch('demo'), project: 'spark' }],
    });

    expect(proposals).toEqual([]);
  });
});

describe('distinctiveName', () => {
  it.each([
    ['Fraud Guard - AI-Powered Transaction Monitoring', 'Fraud Guard'],
    ['SparkMind - AI-Driven Personalized Learning Hub', 'SparkMind'],
    ['example.dev – Personal Portfolio', 'example.dev'],
    [
      'Brain Tumor Segmentation & Classification (CNN/U-Net)',
      'Brain Tumor Segmentation & Classification',
    ],
    ['Product Decoder', 'Product Decoder'],
    ['ui-capture', 'ui-capture'],
    ['In2ne - AI-Driven Music Recommendation', 'In2ne'],
  ])('reads %j as %j', (title, name) => {
    expect(distinctiveName(title)).toBe(name);
  });

  it.each([['synapse'], ['Ralph'], ['Genie - AI Financial Insight Browser Extension'], ['']])(
    'finds none in %j: one ordinary word could be anything',
    (title) => {
      expect(distinctiveName(title)).toBeNull();
    },
  );

  it('reads a long run of spaces once, and finds the same name', () => {
    // A project title has no length cap. Scanned from every space, 40,000 took seconds.
    const run = ' '.repeat(40_000);
    const started = performance.now();
    const name = distinctiveName(`Fraud${run}Guard`);

    expect(performance.now() - started).toBeLessThan(100);
    expect(name).toBe(`Fraud${run}Guard`);
    expect(distinctiveName(`Fraud Guard${run}- Monitoring`)).toBe('Fraud Guard');
    expect(distinctiveName(`Fraud Guard${run}(CNN)`)).toBe('Fraud Guard');
  });
});

describe('titleNamesProject', () => {
  it.each([
    ['Fraud Guard, demo (literal) video', 'Fraud Guard - AI-Powered Transaction Monitoring'],
    [
      'Sparkmind - Calendar Scope verification 1',
      'SparkMind - AI-Driven Personalized Learning Hub',
    ],
    ['Product Decoder - Overview', 'Product Decoder'],
  ])('%j names %j', (title, project) => {
    expect(titleNamesProject(title, project)).toBe(true);
  });

  it.each([
    ['Bonus Project 1 - Fraud Transaction', 'Fraud Guard - AI-Powered Transaction Monitoring'],
    [
      'Project 3 - Brain Tumor Classifaction',
      'Brain Tumor Segmentation & Classification (CNN/U-Net)',
    ],
    ['RamHacks 2026 - CompSci Path', "RamHacks '25 Website"],
    ['Portfolio - revamp 3 - 2025', 'example.dev – Personal Portfolio'],
    ['Sparkminds of tomorrow', 'SparkMind - AI-Driven Personalized Learning Hub'],
    ['Product AI - Design Overview', 'Product Decoder'],
  ])('%j does not name %j', (title, project) => {
    expect(titleNamesProject(title, project)).toBe(false);
  });
});

describe('relateProjects', () => {
  it('returns new entries and leaves its input as it was', () => {
    const sources = {
      videos: [video('v', { description: 'https://github.com/Example/product-decoder' })],
    };
    const entries = buildFeed(sources, noImages);
    const before = JSON.stringify(entries);

    const result = relateProjects(entries, projectSignals(sources), PROJECTS, NO_RULES);

    expect(JSON.stringify(entries)).toBe(before);
    expect(result).not.toBe(entries);
    expect(result.map((entry) => entry.id)).toEqual(entries.map((entry) => entry.id));
  });

  it('relates nothing without projects', () => {
    const sources = {
      videos: [video('v', { description: 'https://github.com/Example/product-decoder' })],
    };

    expect(
      projectsOf(
        relateProjects(buildFeed(sources, noImages), projectSignals(sources), [], NO_RULES),
      ),
    ).toEqual({});
  });
});

describe('the project map', () => {
  it.each([
    ['MEDIA_PROJECTS', MEDIA_PROJECTS],
    ['MEDIA_NOT_PROJECTS', MEDIA_NOT_PROJECTS],
  ])('%s holds only rules the page can read', (_name, rules) => {
    for (const rule of rules) {
      expect(rule.item).toMatch(/^(?:https?:\/\/\S+|[\w-]{11})$/);
      expect(rule.project).toMatch(/^[A-Za-z0-9._-]{1,128}$/);
    }
  });

  it('names no item twice', () => {
    const items = MEDIA_PROJECTS.map((rule) => rule.item);

    expect(new Set(items).size).toBe(items.length);
  });

  it("does not read the site's own address as evidence", () => {
    expect(MEDIA_PROJECT_RULES.siteHost).toBe(SITE_HOST);
    expect(MEDIA_PROJECT_RULES.links).toBe(MEDIA_PROJECTS);
    expect(MEDIA_PROJECT_RULES.notLinks).toBe(MEDIA_NOT_PROJECTS);
  });
});
