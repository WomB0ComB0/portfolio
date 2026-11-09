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
 * @file The filter schema every filter page shares (/certifications now; /projects and /places
 * next). No directive: server pages, client islands and tests all import it.
 */

export {
  defineFilters,
  type FilterParsers,
  type FilterSchema,
  type FilterSchemaInput,
} from './define-filters';
export {
  allOf,
  DEFAULT_QUERY_MAX_LENGTH,
  firstOf,
  normaliseQuery,
  ownValue,
  type ParamValue,
} from './normalise';
export { defaultScope, noMatchSentence, type StatusWords, statusSentence } from './sentences';
export type {
  FacetOption,
  FacetOptions,
  FacetSpec,
  FilterPatch,
  FilterState,
  Noun,
  RawFilterValues,
  StatusInput,
} from './types';
