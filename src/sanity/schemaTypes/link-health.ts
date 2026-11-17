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

import { defineField, defineType } from 'sanity';

/** Generated cache only; the workflow writes it independently of authored portfolio content. */
export const linkHealthType = defineType({
  name: 'linkHealth',
  title: 'Link health (scheduled)',
  type: 'document',
  readOnly: true,
  fields: [
    defineField({
      name: 'schemaVersion',
      type: 'number',
      validation: (rule) => rule.required().integer().min(1).max(1),
    }),
    defineField({
      name: 'url',
      type: 'url',
      validation: (rule) => rule.required().uri({ scheme: ['http', 'https'] }),
    }),
    defineField({
      name: 'kind',
      type: 'string',
      options: { list: ['reachable', 'missing', 'temporary', 'unknown'] },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'status',
      type: 'string',
      options: { list: ['reachable', 'unavailable', 'unknown'] },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'httpStatus',
      type: 'number',
      validation: (rule) => rule.integer().min(100).max(599),
    }),
    defineField({ name: 'checkedAt', type: 'datetime', validation: (rule) => rule.required() }),
    defineField({ name: 'nextCheckAt', type: 'datetime', validation: (rule) => rule.required() }),
    defineField({ name: 'missingSince', type: 'datetime' }),
  ],
  preview: { select: { title: 'url', subtitle: 'status' } },
});
