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

import { FetchHttpClient } from '@effect/platform';
import { Effect, pipe, Schema } from 'effect';
import { ensureBaseError } from '@/classes/error';
import { env } from '@/env';
import { get } from '@/lib/http-clients/effect-fetcher';

// Schema for Better Stack Monitor attributes
const BetterStackMonitorAttributesSchema = Schema.Struct({
  url: Schema.String,
  pronounceable_name: Schema.String,
  monitor_type: Schema.String,
  status: Schema.Union(
    Schema.Literal('up'),
    Schema.Literal('down'),
    Schema.Literal('paused'),
    Schema.Literal('validating'),
    Schema.Literal('maintenance'),
  ),
  paused: Schema.Boolean,
  last_checked_at: Schema.NullOr(Schema.String),
  created_at: Schema.String,
  updated_at: Schema.String,
});

// Schema for Better Stack Monitor
const BetterStackMonitorSchema = Schema.Struct({
  id: Schema.String,
  type: Schema.Literal('monitor'),
  attributes: BetterStackMonitorAttributesSchema,
});

// Schema for Better Stack Monitors API response
const BetterStackMonitorsResponseSchema = Schema.Struct({
  data: Schema.Array(BetterStackMonitorSchema),
});

export type BetterStackMonitor = Schema.Schema.Type<typeof BetterStackMonitorSchema>;
export type BetterStackMonitorsResponse = Schema.Schema.Type<
  typeof BetterStackMonitorsResponseSchema
>;

type ServiceState = 'operational' | 'degraded' | 'down' | 'unknown';

const CACHE_DURATION = 60 * 1_000; // 60 seconds
let cache: { data: { state: ServiceState; lastUpdated: string }; timestamp: number } | null = null;

/**
 * Handles the status check by fetching from Better Stack monitors API
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
    const effect = pipe(
      get('https://uptime.betterstack.com/api/v2/monitors', {
        schema: BetterStackMonitorsResponseSchema,
        retries: 2,
        timeout: 10_000,
        headers: {
          Authorization: `Bearer ${env.BETTERSTACK_API_KEY}`,
        },
      }),
      Effect.provide(FetchHttpClient.layer),
    );

    const response = await Effect.runPromise(effect);

    // Determine overall state based on monitor statuses
    let state: ServiceState = 'operational';

    if (response?.data && Array.isArray(response.data)) {
      const activeMonitors = response.data.filter((monitor) => !monitor.attributes.paused);

      if (activeMonitors.length === 0) {
        // No active monitors - assume operational
        state = 'operational';
      } else {
        // Count monitors by status
        const downMonitors = activeMonitors.filter((m) => m.attributes.status === 'down');
        const maintenanceMonitors = activeMonitors.filter(
          (m) => m.attributes.status === 'maintenance',
        );
        const upMonitors = activeMonitors.filter((m) => m.attributes.status === 'up');

        if (downMonitors.length > 0) {
          // Any monitor down = system down
          state = 'down';
        } else if (maintenanceMonitors.length > 0) {
          // Monitors in maintenance = degraded
          state = 'degraded';
        } else if (upMonitors.length === activeMonitors.length) {
          // All monitors up = operational
          state = 'operational';
        } else {
          // Mixed state or validating = degraded
          state = 'degraded';
        }
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
    // If we have cached data, return it even if expired rather than failing completely
    if (cache) {
      return {
        ...cache.data,
        message: 'Using cached status data due to API error',
      };
    }

    // If no cache available, return a degraded state instead of throwing
    const fallbackResult = {
      state: 'unknown' as ServiceState,
      message: 'Unable to fetch current status - please try again later',
      lastUpdated: new Date().toISOString(),
    };

    // Cache the fallback for a shorter duration to retry sooner
    cache = { data: fallbackResult, timestamp: Date.now() - CACHE_DURATION + 10_000 }; // Expire in 10s

    throw ensureBaseError(error, 'status:fetch', {
      apiEndpoint: 'monitors',
      cacheExpired: !cache || Date.now() - cache.timestamp >= CACHE_DURATION,
      fallbackProvided: true,
    });
  }
}
