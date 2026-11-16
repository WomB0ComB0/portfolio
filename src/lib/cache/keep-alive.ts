import 'server-only';
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
 * @file Keeps a background task (a cache refresh a page did not wait for) running after the
 * response has been sent.
 *
 * On a serverless host, work still running when the response ends can be frozen or cut off.
 * Next's after() (next/server, Next 15.1+) hands the promise to the host's waitUntil on Vercel,
 * or to the Node server's own awaiter under `next start` and `next dev`, where it simply runs on
 * and the server waits for it before it closes. after() works in server components, route
 * handlers and server actions, and throws outside a request (a unit test, a script).
 */

import { after } from 'next/server';

const settledQuietly = (): undefined => undefined;

/**
 * Keeps `task` alive past the end of the current response. after() gets a promise that never
 * rejects: the caller reports the task's own failure, so Next logs no second copy of it.
 */
export function keepAlive(task: Promise<unknown>): void {
  const settled = task.then(settledQuietly, settledQuietly);
  try {
    after(settled);
  } catch {
    // Outside a request scope there is no response to outlive: the task already runs and still
    // settles (and reports) on its own, so only the keep-alive is skipped.
  }
}
