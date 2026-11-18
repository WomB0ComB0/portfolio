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

import { t } from 'elysia';

/** Public projections resolve uploaded assets; keep optional media at both experience levels. */
const mediaImage = t.Object(
  {
    _type: t.Literal('image'),
    asset: t.Object({ _ref: t.String(), _type: t.Literal('reference') }),
  },
  { additionalProperties: true },
);
const mediaFile = t.Object({
  url: t.String(),
  mimeType: t.Optional(t.Union([t.String(), t.Null()])),
  originalFilename: t.Optional(t.Union([t.String(), t.Null()])),
  size: t.Optional(t.Union([t.Number(), t.Null()])),
});
const media = t.Optional(
  t.Union([
    t.Null(),
    t.Array(
      t.Union([
        t.Object({
          _key: t.String(),
          _type: t.Literal('portfolioPhoto'),
          image: mediaImage,
          alt: t.String(),
          caption: t.Optional(t.Union([t.String(), t.Null()])),
        }),
        t.Object({
          _key: t.String(),
          _type: t.Literal('portfolioVideo'),
          title: t.String(),
          file: t.Optional(t.Union([mediaFile, t.Null()])),
          externalUrl: t.Optional(t.Union([t.String(), t.Null()])),
          poster: t.Optional(t.Union([mediaImage, t.Null()])),
          caption: t.Optional(t.Union([t.String(), t.Null()])),
          captionsFile: t.Optional(t.Union([mediaFile, t.Null()])),
          captionsLanguage: t.Optional(t.Union([t.String(), t.Null()])),
          captionsLabel: t.Optional(t.Union([t.String(), t.Null()])),
        }),
      ]),
    ),
  ]),
);

/**
 * Experience Response Schema
 */
export const experienceSchema = t.Object({
  _id: t.String(),
  _type: t.String(),
  _createdAt: t.String(),
  _updatedAt: t.String(),
  company: t.String(),
  position: t.String(),
  employmentType: t.Optional(t.Union([t.String(), t.Null()])),
  dateNote: t.Optional(t.Union([t.String(), t.Null()])),
  location: t.String(),
  startDate: t.String(),
  endDate: t.Optional(t.Union([t.String(), t.Null()])),
  current: t.Boolean(),
  description: t.String(),
  responsibilities: t.Array(t.String()),
  technologies: t.Array(t.String()),
  media,
  subRoles: t.Optional(
    t.Union([
      t.Array(
        t.Object({
          _key: t.String(),
          _type: t.Optional(t.Union([t.Literal('experienceSubRole'), t.Null()])),
          media,
          position: t.String(),
          employmentType: t.Optional(t.Union([t.String(), t.Null()])),
          startDate: t.String(),
          endDate: t.Optional(t.Union([t.String(), t.Null()])),
          current: t.Optional(t.Boolean({ default: false })),
          description: t.Optional(t.Union([t.String(), t.Null()])),
          responsibilities: t.Optional(t.Union([t.Array(t.String()), t.Null()])),
          technologies: t.Optional(t.Union([t.Array(t.String()), t.Null()])),
        }),
      ),
      t.Null(),
    ]),
  ),
  logo: t.Optional(
    t.Union([
      t.Object({
        _type: t.String(),
        asset: t.Object({
          _ref: t.String(),
          _type: t.String(),
        }),
        alt: t.Optional(t.String()),
      }),
      t.Null(),
    ]),
  ),
  companyUrl: t.Optional(t.Union([t.String(), t.Null()])),
  order: t.Number(),
});
