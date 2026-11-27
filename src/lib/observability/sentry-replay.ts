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
 * @file Sentry Session Replay, on its own. instrumentation-client.ts imports this module with a
 * dynamic import() after Sentry.init and adds the integration then, Sentry's documented way to
 * lazy-load Replay. A dynamic import of '@sentry/nextjs' itself would not split anything: that
 * module is already in the entry chunk. Re-exporting the one integration from a module of our own
 * gives Turbopack a separate async chunk for Replay (about 38 KB gzipped), which every page used
 * to load and run ahead of hydration.
 */

export { replayIntegration } from '@sentry/nextjs';
