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

import { ensureBaseError } from '@/classes/error';
import { env } from '@/env';
import { get } from '@/lib/http-clients/effect-fetcher';
import { FetchHttpClient } from '@effect/platform';
import { Effect, pipe, Schema } from 'effect';

const BetterStackIncidentAttributesSchema = Schema.Struct({
  name: Schema.String,
  status: Schema.Union(
    Schema.Literal('investigating'),
    Schema.Literal('identified'),
    Schema.Literal('monitoring'),
    Schema.Literal('resolved'),
    Schema.Literal('ongoing'),
  ),
  started_at: Schema.String,
  resolved_at: Schema.NullOr(Schema.String),
  cause: Schema.NullOr(Schema.String),
});

const BetterStackIncidentSchema = Schema.Struct({
  id: Schema.String,
  type: Schema.String,
  attributes: BetterStackIncidentAttributesSchema,
});

const BetterStackResponseSchema = Schema.Struct({
  data: Schema.Array(BetterStackIncidentSchema),
});

export type BetterStackIncident = Schema.Schema.Type<typeof BetterStackIncidentSchema>;
export type BetterStackResponse = Schema.Schema.Type<typeof BetterStackResponseSchema>;

type ServiceState = 'operational' | 'degraded' | 'down' | 'unknown';

const CACHE_DURATION = 60 * 1_000; // 60 seconds
let cache: { data: { state: ServiceState; lastUpdated: string }; timestamp: number } | null = null;

/**
 * Handles the status check by fetching from Better Stack status page
 * @async
 * @function
 * @returns {Promise<{ state: ServiceState; lastUpdated: string; message?: string }>}
 * @throws {Error} If unable to fetch status
 * @author Mike Odnis
 * @version 1.0.0
 */
export async function handleStatusCheck(): Promise<{
  state: ServiceState;
  lastUpdated: string;
  message?: string;
}> {
  // Return cached data if still valid
  if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
    return cache.data;
  }

  try {
    const statusPageId = env.BETTERSTACK_STATUS_PAGE_ID;

    if (!statusPageId) {
      return {
        state: 'unknown',
        message: 'Status page not configured',
        lastUpdated: new Date().toISOString(),
      };
    }

    const effect = pipe(
      get(`https://uptime.betterstack.com/api/v2/status-pages/${statusPageId}/resources`, {
        schema: BetterStackResponseSchema,
        retries: 2,
        timeout: 10_000,
        headers: {
          Authorization: `Bearer ${env.BETTERSTACK_API_KEY}`,
        },
      }),
      Effect.provide(FetchHttpClient.layer),
    );

    const response = await Effect.runPromise(effect);

    // Determine overall state based on incidents
    let state: ServiceState = 'operational';

    if (response?.data && Array.isArray(response.data)) {
      const ongoingIncidents = response.data.filter(
        (incident) =>
          incident.attributes.status === 'investigating' ||
          incident.attributes.status === 'identified' ||
          incident.attributes.status === 'monitoring' ||
          incident.attributes.status === 'ongoing',
      );

      if (ongoingIncidents.length > 0) {
        // Check severity of incidents
        const hasDownIncident = ongoingIncidents.some((incident) =>
          incident.attributes.name.toLowerCase().includes('down'),
        );

        state = hasDownIncident ? 'down' : 'degraded';
      }
    }

    const result = {
      state,
      lastUpdated: new Date().toISOString(),
    };

    // Cache the result
    cache = { data: result, timestamp: Date.now() };

    return result;
  } catch (error) {
    throw ensureBaseError(error, 'status:fetch', {
      statusPageId: env.BETTERSTACK_STATUS_PAGE_ID,
      cacheExpired: !cache || Date.now() - cache.timestamp >= CACHE_DURATION,
    });
  }
}
