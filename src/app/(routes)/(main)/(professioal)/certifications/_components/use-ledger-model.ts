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

'use client';

/**
 * @file The FilterModel for /certifications, unified onto the shared `nuqs`-backed
 * `useUrlFilters` hook used by /projects, /places, /places/photos, and /media.
 */

import { useMemo } from 'react';

import { type BuiltFilterModel, useUrlFilters } from '@/components/console/filter-bar';
import {
  type CertificationItem,
  type CertificationLookups,
  certificationFilters,
} from '../_lib/certification-filters';

/** The FilterModel for /certifications, backed by the shared nuqs `useUrlFilters` hook. */
export function useLedgerModel<T extends CertificationItem>(
  rows: readonly T[],
  lookups: CertificationLookups,
): BuiltFilterModel<T> {
  const schema = useMemo(() => certificationFilters<T>(lookups), [lookups]);
  return useUrlFilters(schema, rows);
}
