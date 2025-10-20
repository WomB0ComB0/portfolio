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
 * Health check middleware
 * Currently no authentication required for health endpoints
 * These are typically public endpoints for monitoring systems
 */

/**
 * Future: Could add rate limiting middleware here
 * to prevent health endpoint abuse
 */
export const healthMiddleware = {
  // No authentication required for health checks
  // These endpoints are typically monitored by external systems
};
