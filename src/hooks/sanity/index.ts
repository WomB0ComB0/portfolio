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
 * @fileoverview A few per-document Effect schemas of Sanity, and the Resume type.
 *
 * Pages load Sanity data on the server through the cached loaders in '@/lib/sanity/loaders',
 * which decode one document at a time with the schemas in './schemas' (imported from there
 * directly, not through this barrel). There are no client-side Sanity hooks, and no list schemas:
 * nothing in the browser decodes a whole Sanity collection.
 *
 * @example
 * ```ts
 * import { ProjectSchema, type Resume } from '@/hooks/sanity';
 * ```
 */

export {
  CertificationSchema,
  ExperienceSchema,
  ProjectSchema,
  type Resume,
  ResumeSchema,
} from './schemas';
