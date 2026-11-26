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

import 'server-only';

/**
 * @file Server-only entry point for loading and paging the EbookFoundation free programming books
 * catalog (overlaying live Upstash Redis security manifests onto the committed baseline).
 * Enforces Next.js's `server-only` compiler boundary for RSC pages and API routes while keeping
 * pure parsers in `./free-programming-books` importable from CLI verification scripts.
 */

export {
  buildFreeBooksPageResponse,
  buildFreeProgrammingBooksCatalog,
  loadFreeProgrammingBooks,
} from './free-programming-books';
