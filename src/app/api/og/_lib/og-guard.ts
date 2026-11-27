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

import 'server-only';

/**
 * @file The API guard in front of every card route under /api/og (the page card, a book's card
 * and a shelf's card): each distinct URL is a fresh render on a CDN miss, so the per-IP sliding
 * window and ban lists /api uses (src/lib/security/api-guard.ts) run first. Moved here from
 * src/app/api/og/route.tsx so the three routes share it; a route file may export only its
 * handlers.
 */

import { apiGuardHook } from '@/app/api/_elysia/shared/guard';
import { logger } from '@/utils';

/**
 * The API guard's refusal of `request`, or null to draw the card. The guard answers 403 to a
 * banned client and 429 with Retry-After to one over its limit, both `no-store` so the CDN never
 * serves them to anyone else. It fails open: the guard itself allows when Upstash is unset, slow
 * or failing, and anything it throws here draws the card too.
 */
export async function guardRefusal(request: Request): Promise<Response | null> {
  const set: { status?: number; headers: Record<string, string | number> } = { headers: {} };
  try {
    const body = await apiGuardHook({ request, set });
    if (body === undefined) return null;
    const headers = Object.fromEntries(
      Object.entries(set.headers).map(([name, value]) => [name, String(value)]),
    );
    return Response.json(body, { status: set.status, headers });
  } catch (error) {
    logger.warn('The OG guard failed; drawing the card', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
