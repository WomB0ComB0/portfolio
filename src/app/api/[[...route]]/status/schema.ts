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

import { type Static, t } from 'elysia';

/**
 * @constant statusSchemas
 * @type {Object}
 * @description
 * Zod/Elysia schema definitions for status check endpoints.
 * Provides type safety and validation for status-related API responses.
 * @author Mike Odnis
 * @version 1.0.0
 * @public
 * @readonly
 */
export const statusSchemas = {
  'status.response': t.Object({
    success: t.Literal(true),
    message: t.String(),
    data: t.Object({
      state: t.Union([
        t.Literal('operational'),
        t.Literal('degraded'),
        t.Literal('down'),
        t.Literal('unknown'),
      ]),
      lastUpdated: t.String(),
      message: t.Optional(t.String()),
      /**
       * How many of the active (unpaused) Better Stack monitors are up. Only a fresh or cached
       * check has it; the 'unknown' fallbacks do not.
       */
      monitors: t.Optional(t.Object({ up: t.Number(), total: t.Number() })),
      /**
       * True when Better Stack just failed and this is the last answer it gave, served from the
       * cache (its `lastUpdated` says when). Absent on a current answer and on the fallbacks.
       */
      stale: t.Optional(t.Boolean()),
    }),
  }),
  'status.error': t.Object({
    success: t.Literal(false),
    message: t.String(),
    error: t.String(),
  }),
} as const;

/** What /api/status answers in `data`, and what handleStatusCheck resolves to. */
export type ServiceStatus = Static<(typeof statusSchemas)['status.response']>['data'];
