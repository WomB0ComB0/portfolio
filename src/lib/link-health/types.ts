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

/** Cached reachability of published content links; independent of any browser or server API. */
export const LINK_HEALTH_SCOPES = ['projects', 'media', 'certifications', 'experience'] as const;
export type LinkHealthScope = (typeof LINK_HEALTH_SCOPES)[number];
export type LinkHealthStatus = 'reachable' | 'unavailable' | 'unknown';
export interface LinkHealthEntry {
  status: LinkHealthStatus;
  checkedAt: string;
}
export interface LinkHealthResponse {
  links: Record<string, LinkHealthEntry>;
}
export interface LinkObservation {
  kind: 'reachable' | 'missing' | 'temporary' | 'unknown';
  httpStatus?: number;
}
