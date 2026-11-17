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
  subRoles: t.Optional(
    t.Union([
      t.Array(
        t.Object({
          _key: t.String(),
          _type: t.Optional(t.Union([t.Literal('experienceSubRole'), t.Null()])),
          position: t.String(),
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
