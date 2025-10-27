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
  location: t.String(),
  startDate: t.String(),
  endDate: t.Optional(t.Union([t.String(), t.Null()])),
  current: t.Boolean(),
  description: t.String(),
  responsibilities: t.Array(t.String()),
  technologies: t.Array(t.String()),
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

/**
 * Project Response Schema
 */
export const projectSchema = t.Object({
  _id: t.String(),
  _type: t.String(),
  _createdAt: t.String(),
  _updatedAt: t.String(),
  title: t.String(),
  slug: t.Object({
    _type: t.String(),
    current: t.String(),
  }),
  description: t.String(),
  longDescription: t.Optional(t.Union([t.String(), t.Null()])),
  image: t.Optional(
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
  images: t.Optional(t.Union([t.Array(t.Any()), t.Null()])),
  technologies: t.Array(t.String()),
  githubUrl: t.Optional(t.Union([t.String(), t.Null()])),
  liveUrl: t.Optional(t.Union([t.String(), t.Null()])),
  featured: t.Boolean(),
  category: t.String(),
  startDate: t.Union([t.String(), t.Null()]),
  endDate: t.Optional(t.Union([t.String(), t.Null()])),
  order: t.Number(),
  status: t.String(),
});

/**
 * Certification Response Schema
 */
export const certificationSchema = t.Object({
  _id: t.String(),
  _type: t.String(),
  _createdAt: t.String(),
  _updatedAt: t.String(),
  name: t.String(),
  issuer: t.String(),
  issueDate: t.String(),
  expiryDate: t.Optional(t.Union([t.String(), t.Null()])),
  credentialId: t.Optional(t.Union([t.String(), t.Null()])),
  credentialUrl: t.Optional(t.Union([t.String(), t.Null()])),
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
  description: t.Optional(t.Union([t.String(), t.Null()])),
  skills: t.Array(t.String()),
  order: t.Number(),
});

/**
 * Sanity Schemas Export
 */
export const sanitySchemas = {
  'sanity.experiences': t.Array(experienceSchema),
  'sanity.projects': t.Array(projectSchema),
  'sanity.featuredProjects': t.Array(projectSchema),
  'sanity.certifications': t.Array(certificationSchema),
  'sanity.error': t.Object({
    error: t.String(),
    message: t.Optional(t.String()),
  }),
};
