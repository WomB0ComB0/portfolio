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

import { cleanup, render, screen } from '@testing-library/react';
import {
  makeArticle,
  makeCertification,
  makeExperience,
  makePresentation,
  makeTalk,
  makeVideo,
} from '@tests/fixtures/sanity-docs';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/link-health/link-health-badge', () => ({
  LinkHealthBadge: ({ href, scope, label }: { href: string; scope: string; label?: string }) => (
    <span data-health-href={href} data-health-scope={scope}>
      {label ? `${label}: ` : ''}Unavailable · Checked Nov 16, 14:28 UTC
    </span>
  ),
}));
vi.mock('@/lib/sanity/client', async () => {
  const { createImageUrlBuilder } = await import('@sanity/image-url');
  const builder = createImageUrlBuilder({ projectId: 'test', dataset: 'test' });
  return { urlFor: (source: Parameters<typeof builder.image>[0]) => builder.image(source) };
});

import { PairLink } from '@/app/(routes)/(dev)/media/_components/feed-see-also';
import { ProjectMedia } from '@/app/(routes)/(dev)/media/_components/project-media';
import { MediaFeedView } from '@/app/(routes)/(dev)/media/_interface/media-feed/media-feed';
import { buildFeed } from '@/app/(routes)/(dev)/media/_lib/media-feed';
import { BigCredential } from '@/app/(routes)/(main)/(professioal)/certifications/_components/credential';
import { IssuerGroups } from '@/app/(routes)/(main)/(professioal)/certifications/_components/issuer-group';
import { buildLedger } from '@/app/(routes)/(main)/(professioal)/certifications/_lib/ledger';
import { issuerGroups } from '@/app/(routes)/(main)/(professioal)/certifications/_lib/record';
import { RoleLinkChips } from '@/app/(routes)/(main)/(professioal)/experience/_components/role-row-parts';
import { LinkedProse } from '@/app/(routes)/(main)/(professioal)/experience/_components/story/linked-prose';
import { RoleDetail } from '@/app/(routes)/(main)/(professioal)/experience/_interface/role-detail/role-detail';
import { CaseLinks } from '@/app/(routes)/(main)/(professioal)/projects/_components/detail/case-facts';
import { StoryActions } from '@/app/(routes)/(main)/(professioal)/projects/_components/story-parts';
import { post } from '../media/media-feed-fixtures';

afterEach(cleanup);
const badges = (scope: string) => [...document.querySelectorAll(`[data-health-scope="${scope}"]`)];
const hrefs = (scope: string) =>
  badges(scope).map((badge) => badge.getAttribute('data-health-href'));
const notInLinks = () => {
  for (const badge of document.querySelectorAll('[data-health-href]'))
    expect(badge.closest('a')).toBeNull();
};

describe('explicit link-health integration', () => {
  it('adds project action and detail statuses without changing original link names or targets', () => {
    const live = 'https://demo.example/app#setup';
    const source = 'https://github.com/owner/repository';
    render(
      <>
        <StoryActions entry={{ title: 'Demo', liveUrl: live, githubUrl: source }} />
        <CaseLinks live={live} host="demo.example" source={source} />
      </>,
    );
    expect(hrefs('projects')).toEqual([live, source, live, source]);
    expect(
      screen.getByRole('link', { name: 'Live for Demo (opens in a new tab)' }),
    ).toHaveAttribute('href', live);
    expect(screen.getAllByRole('link')).toHaveLength(4);
    for (const link of screen.getAllByRole('link'))
      expect(link).toHaveAttribute('target', '_blank');
    notInLinks();
  });

  it('covers big and grouped credentials, including stored files, and keeps ID copy controls', () => {
    const ledger = buildLedger([
      makeCertification({
        credentialUrl: 'https://cert.example/record.pdf',
        credentialId: 'CERT-123',
        title: 'Credential',
      }),
    ]);
    const entry = ledger.entries[0];
    if (!entry) throw new Error('no credential');
    render(
      <>
        <ul>
          <BigCredential entry={entry} />
        </ul>
        <IssuerGroups groups={issuerGroups(ledger.entries)} chapterId="certs" />
      </>,
    );
    expect(hrefs('certifications')).toEqual([entry.link?.href, entry.link?.href]);
    expect(screen.getAllByRole('button', { name: /Copy.*credential ID/i })).toHaveLength(2);
    notInLinks();
  });

  it('covers selected Media destinations but not unused alternatives or standalone videos', () => {
    const entries = buildFeed(
      {
        posts: [post({ url: 'https://blog.example/writeup' })],
        articles: [makeArticle({ publicationUrl: 'https://article.example/story' })],
        talks: [
          makeTalk({
            videoUrl: 'https://www.youtube.com/watch?v=talk0000001',
            slidesUrl: 'https://slides.example/unused',
          }),
        ],
        presentations: [
          makePresentation({
            slidesUrl: 'https://slides.example/deck',
            videoUrl: 'https://video.example/unused',
          }),
        ],
        videos: [makeVideo({ videoId: 'video000001' })],
      },
      () => null,
    );
    render(
      <NuqsTestingAdapter>
        <MediaFeedView feed={{ entries, missing: [] }} parts="each" play="link" path="/media" />
      </NuqsTestingAdapter>,
    );
    expect(hrefs('media').sort()).toEqual(
      [
        'https://blog.example/writeup',
        'https://article.example/story',
        'https://www.youtube.com/watch?v=talk0000001',
        'https://slides.example/deck',
      ].sort(),
    );
    notInLinks();
  });

  it('labels a written pair and project write-up with Media scope, excluding video references', () => {
    const written = 'https://blog.example/related';
    const video = 'https://www.youtube.com/watch?v=video000001';
    render(
      <>
        <PairLink
          pair={{ id: 'post', kind: 'post', href: written, title: 'Written', videoId: null }}
          play="link"
        />
        <PairLink
          pair={{ id: 'video', kind: 'video', href: video, title: 'Video', videoId: 'video000001' }}
          play="link"
        />
        <ProjectMedia
          items={[
            { id: 'post', kind: 'post', title: 'Post', href: written },
            { id: 'video', kind: 'video', title: 'Video', href: video },
          ]}
        />
      </>,
    );
    expect(hrefs('media')).toEqual([written, written]);
    notInLinks();
  });

  it('covers Experience inline content and detail chips without swallowing punctuation or URLs', () => {
    const href = 'https://content.example/report#section';
    render(
      <>
        <LinkedProse
          parts={[
            { kind: 'text', text: 'See (' },
            { kind: 'link', href, label: 'content.example' },
            { kind: 'text', text: ').' },
          ]}
        />
        <RoleLinkChips links={[{ href, label: 'Report', host: 'content.example', token: false }]} />
      </>,
    );
    expect(hrefs('experience')).toEqual([href, href]);
    expect(screen.getAllByRole('link')).toHaveLength(2);
    for (const link of screen.getAllByRole('link')) expect(link).toHaveAttribute('href', href);
    expect(document.querySelector('[data-prose]')?.textContent).toContain(').');
    const prose = document.querySelector('[data-prose]');
    expect(prose?.querySelector('a')?.nextSibling?.textContent).toBe(').');
    expect(prose?.querySelector('[data-prose-link-health] [data-health-href]')).not.toBeNull();
    notInLinks();
  });

  it('deduplicates contextual prose notes by canonical URL while preserving both original anchors', () => {
    render(
      <LinkedProse
        parts={[
          { kind: 'link', href: 'https://content.example/report#one', label: 'First section' },
          { kind: 'text', text: ' and ' },
          { kind: 'link', href: 'https://content.example/report#two', label: 'Second section' },
          { kind: 'text', text: '.' },
        ]}
      />,
    );
    expect(hrefs('experience')).toEqual(['https://content.example/report#one']);
    expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      'https://content.example/report#one',
      'https://content.example/report#two',
    ]);
    expect(document.querySelector('[data-prose-link-health]')).toHaveTextContent(
      'First section: Unavailable',
    );
    notInLinks();
  });

  it('covers the Experience detail company destination, while internal technology/role links stay unlabelled', () => {
    const experience = makeExperience({
      _id: 'role',
      companyUrl: 'https://organization.example/',
      description: 'Build tools',
      responsibilities: [],
      technologies: [],
    });
    render(
      <RoleDetail
        experience={experience}
        experiences={[experience]}
        projects={[]}
        today="2026-11-16"
      />,
    );
    expect(hrefs('experience')).toEqual(['https://organization.example/']);
    notInLinks();
  });
});
