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

import { Resolver } from 'node:dns/promises';

/**
 * A per-check resolver can cancel its real DNS work, unlike an uncancellable OS lookup.
 * Both address families share the probe's AbortSignal and are inspected before connection.
 */
export async function resolveHostAddresses(
  hostname: string,
  signal: AbortSignal,
): Promise<readonly string[]> {
  signal.throwIfAborted();
  const resolver = new Resolver({ timeout: 5000, tries: 1 });
  const cancel = (): void => resolver.cancel();
  signal.addEventListener('abort', cancel, { once: true });
  try {
    const results = await Promise.allSettled([
      resolver.resolve4(hostname),
      resolver.resolve6(hostname),
    ]);
    signal.throwIfAborted();
    return results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
  } finally {
    signal.removeEventListener('abort', cancel);
    resolver.cancel();
  }
}
