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

import { type ValidationClient, validateDocument } from '@sanity/validation';
import { makeExperience, makeProject } from '@tests/fixtures/sanity-docs';
import { Schema } from 'effect';
import { Elysia } from 'elysia';
import { evaluate, parse } from 'groq-js';
import { createSchema } from 'sanity';
import { describe, expect, it } from 'vitest';
import { experienceSchema as apiExperience } from '@/app/api/v1/[[...route]]/sanity/schema';
import { ExperienceSchema, ProjectSchema } from '@/hooks/sanity/schemas';
import {
  experienceByIdQuery,
  experiencesQuery,
  featuredProjectsQuery,
  projectBySlugQuery,
  projectsQuery,
} from '@/lib/sanity/queries';
import { experienceSchema as legacyExperience } from '@/lib/sanity/schemas';
import { schema } from '@/sanity/schemaTypes';
import { experienceType } from '@/sanity/schemaTypes/experience';
import { portfolioPhotoType, portfolioVideoType } from '@/sanity/schemaTypes/portfolio-media';
import { projectType } from '@/sanity/schemaTypes/project';

const image = {
  _type: 'image' as const,
  asset: { _type: 'reference' as const, _ref: 'image-photo-1600x900-png' },
};
const photo = {
  _key: 'photo',
  _type: 'portfolioPhoto' as const,
  image,
  alt: 'Dashboard showing the selected project',
  caption: 'Project overview',
};
const file = {
  url: 'https://cdn.sanity.io/files/test/production/demo.mp4',
  mimeType: 'video/mp4',
  originalFilename: 'demo.mp4',
  size: 1200,
};
const video = {
  _key: 'video',
  _type: 'portfolioVideo' as const,
  title: 'A short walkthrough',
  file,
  poster: image,
};
const link = {
  _key: 'link',
  _type: 'portfolioVideo' as const,
  title: 'Watch the presentation',
  externalUrl: 'https://www.youtube.com/watch?v=example',
};
const child = { _key: 'engineer', position: 'Engineer', startDate: '2024-01-01', current: false };
const decodeProject = Schema.decodeUnknownSync(ProjectSchema);
const decodeExperience = Schema.decodeUnknownSync(ExperienceSchema);

describe('portfolio media decoding', () => {
  it.each([undefined, null, []])(
    'preserves readable legacy parents and child roles with media %j',
    (media) => {
      expect(decodeProject({ ...makeProject(), media }).media ?? []).toEqual([]);
      const source = makeExperience();
      const result = decodeExperience({ ...source, media, subRoles: [{ ...child, media }] });
      expect(result._id).toBe(source._id);
      expect(result.subRoles?.[0]?.position).toBe('Engineer');
      expect(result.subRoles?.[0]?.media ?? []).toEqual([]);
    },
  );
  it('keeps ordered mixed media independently on projects, organizations and child roles', () => {
    expect(decodeProject({ ...makeProject(), media: [photo, video, link] }).media).toEqual([
      photo,
      video,
      link,
    ]);
    const result = decodeExperience({
      ...makeExperience(),
      media: [photo],
      subRoles: [{ ...child, media: [video, link] }],
    });
    expect(result.media).toEqual([photo]);
    expect(result.subRoles?.[0]?.media).toEqual([video, link]);
  });
  it.each([
    null,
    {},
    'wrong',
    { ...photo, alt: ' ' },
    { ...photo, image: { ...image, asset: { ...image.asset, _ref: 'broken' } } },
    { ...video, title: '' },
    { ...video, externalUrl: link.externalUrl },
    { ...link, externalUrl: 'javascript:alert(1)' },
    { ...link, externalUrl: 'https://user:secret@example.com/' },
    { ...video, file: { ...file, url: 'https://cdn.sanity.io.evil.example/demo.mp4' } },
    { ...video, file: { ...file, url: 'https://cdn.sanity.io/files/test/production/demo.mov' } },
    { ...video, file: { ...file, mimeType: 'text/html' } },
    { ...video, file: undefined },
  ])('drops a bad sibling without losing valid media or its owning record: %j', (bad) => {
    const result = decodeExperience({
      ...makeExperience(),
      media: [bad, photo],
      subRoles: [{ ...child, media: [video, bad, link] }],
    });
    expect(result.media).toEqual([photo]);
    expect(result.subRoles?.[0]?.media).toEqual([video, link]);
    expect(decodeProject({ ...makeProject(), media: [photo, bad, link] }).media).toEqual([
      photo,
      link,
    ]);
  });
  it('handles null GROQ optional fields and native captions', () => {
    const captionsFile = {
      url: 'https://cdn.sanity.io/files/test/production/captions.vtt',
      mimeType: 'text/vtt',
    };
    const result = decodeProject({
      ...makeProject(),
      media: [
        {
          ...video,
          externalUrl: null,
          caption: null,
          captionsFile,
          captionsLanguage: 'en',
          captionsLabel: 'English',
        },
        { ...link, file: null, poster: null, captionsFile: null },
      ],
    });
    expect(result.media?.[0]).toMatchObject({ file, captionsFile, captionsLanguage: 'en' });
    expect(result.media?.[1]).toEqual(link);
  });
  it('does not change legacy project images', () => {
    const result = decodeProject({ ...makeProject(), image, images: [image], media: [photo] });
    expect(result.image).toEqual(image);
    expect(result.images).toEqual([image]);
  });
});

const asset = { _id: 'file-demo-mp4', _type: 'sanity.fileAsset', ...file };
const sourceVideo = {
  ...video,
  file: { _type: 'file', asset: { _type: 'reference', _ref: asset._id } },
};
for (const [name, query, source, decode, params] of [
  ['projects', projectsQuery, makeProject({ featured: true }), decodeProject, {}],
  ['featured projects', featuredProjectsQuery, makeProject({ featured: true }), decodeProject, {}],
  [
    'project detail',
    projectBySlugQuery,
    makeProject({ slug: { _type: 'slug', current: 'media' } }),
    decodeProject,
    { slug: 'media' },
  ],
  [
    'experiences',
    experiencesQuery,
    { ...makeExperience(), subRoles: [{ ...child, media: [sourceVideo] }] },
    decodeExperience,
    {},
  ],
  [
    'experience detail',
    experienceByIdQuery,
    { ...makeExperience({ _id: 'exp-media' }), subRoles: [{ ...child, media: [sourceVideo] }] },
    decodeExperience,
    { id: 'exp-media' },
  ],
] as const) {
  it(`resolves media assets through the ${name} projection and decoder`, async () => {
    const answer = await evaluate(parse(query), {
      dataset: [{ ...source, media: [photo, sourceVideo, link] }, asset],
      params,
    });
    const value = await answer.get();
    const result = decode(Array.isArray(value) ? value[0] : value);
    expect(result.media).toEqual([photo, video, link]);
    if ('subRoles' in result) expect(result.subRoles?.[0]?.media).toEqual([video]);
  });
}

describe('Studio media inputs', () => {
  it.each([projectType, experienceType, legacyExperience])(
    'offers ordered photo and video entries',
    (type) => {
      expect(type.fields.find((field) => field.name === 'media')).toMatchObject({
        type: 'array',
        of: [{ type: 'portfolioPhoto' }, { type: 'portfolioVideo' }],
      });
    },
  );
  it.each([experienceType, legacyExperience])('offers media on each child role', (type) => {
    const subRoles = type.fields.find((field) => field.name === 'subRoles') as {
      of: { fields: { name: string }[] }[];
    };
    expect(subRoles.of[0]?.fields.find((field) => field.name === 'media')).toBeDefined();
  });
  it('registers both shared media types', () => {
    expect(schema.types.map((type) => type.name)).toEqual(
      expect.arrayContaining(['portfolioPhoto', 'portfolioVideo']),
    );
  });
});

const studioSchema = createSchema({
  name: 'media-test',
  types: [portfolioPhotoType, portfolioVideoType, experienceType],
});
const offline = () => {
  throw new Error('Validation must not query Sanity');
};
const client: ValidationClient = {
  fetch: (async (_query: string, params?: Record<string, unknown>) => {
    const extension = String(params?.id).split('-').at(-1);
    return {
      extension,
      mimeType:
        extension === 'mp4' ? 'video/mp4' : extension === 'vtt' ? 'text/vtt' : `image/${extension}`,
    };
  }) as unknown as ValidationClient['fetch'],
  getDataUrl: offline,
  request: offline,
  observable: { fetch: offline },
  withConfig: () => client,
};
async function studioProblems(media: unknown[]) {
  const { markers } = await validateDocument({
    schema: studioSchema,
    client,
    getDocumentExists: async () => true,
    validateReferenceTypes: false,
    document: { ...makeExperience(), media },
  });
  // Sanity's CLI validator adds unknown-field warnings to object rules; inspect every marker.
  // Studio uses the authored error level, verified below.
  return markers.map((marker) => marker.message);
}

describe('Studio media validation', () => {
  it('keeps invalid video sources blocking in the Studio object rule', () => {
    const rules = studioSchema.get('portfolioVideo')?.validation as { _level: string }[];
    expect(rules[0]?._level).toBe('error');
  });
  it('accepts photos, MP4 uploads and external links', async () => {
    expect(await studioProblems([photo, sourceVideo, link])).toEqual([]);
  });
  it.each([
    [{ ...sourceVideo, externalUrl: link.externalUrl }],
    [{ _key: 'empty', _type: 'portfolioVideo', title: 'No source' }],
    [{ ...sourceVideo, file: { asset: { _ref: 'file-demo-mov' } } }],
    [{ ...link, externalUrl: 'javascript:alert(1)' }],
    [{ ...photo, alt: ' ' }],
    [
      {
        ...photo,
        image: { _type: 'image', asset: { _type: 'reference', _ref: 'image-svg-1600x900-svg' } },
      },
    ],
    [
      {
        ...sourceVideo,
        captionsFile: { asset: { _ref: 'file-captions-vtt' } },
        captionsLanguage: 'bad_language',
        captionsLabel: 'English',
      },
    ],
  ])(
    'rejects invalid sources, formats and missing accessible information: %j',
    async (...items) => {
      expect((await studioProblems(items)).length).toBeGreaterThan(0);
    },
  );
});

it('retains parent and child media in the declared experience API response', async () => {
  const payload = {
    ...makeExperience(),
    location: 'Remote',
    responsibilities: ['Lead engineering'],
    technologies: ['TypeScript'],
    media: [photo, video, link],
    subRoles: [{ ...child, media: [video] }],
  };
  const app = new Elysia().get('/', () => payload, { response: apiExperience });
  const response = await app.handle(new Request('http://localhost/'));
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.media).toEqual(payload.media);
  expect(body.subRoles[0].media).toEqual([video]);
});
