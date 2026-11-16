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
 * @file New York's day for one server request. A role's page reads it in generateMetadata and in
 * the page, which Next runs side by side; read twice, a request across midnight in New York while
 * Sanity is slow could render a role that begins on the 1st under the 404 title, or answer 404
 * under the role's title. React's cache() keeps the first answer for the rest of the request (on
 * the server; elsewhere it is a pass-through), and the next request reads the clock anew.
 */

import { cache } from 'react';
import { nyToday } from '@/app/_components/home/data/format';

/** New York's today (YYYY-MM-DD), the same everywhere in one server request. */
export const requestNyToday: () => string = cache((): string => nyToday());
