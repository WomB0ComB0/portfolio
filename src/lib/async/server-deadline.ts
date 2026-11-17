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

import { keepAlive } from '@/lib/cache/keep-alive';
import { DeadlineError, withDeadline } from './deadline';

/**
 * A server deadline that keeps unfinished work alive after the response, so a late answer can
 * still fill its source's cache. The caller owns the unchanged deadline error and fallback.
 */
export async function withServerDeadline<T>(
  task: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let pending = true;
  const tracked = task.finally(() => {
    pending = false;
  });
  try {
    return await withDeadline(tracked, ms, label);
  } catch (error) {
    // A settled task needs no continuation, even if it failed with a matching DeadlineError.
    if (pending && error instanceof DeadlineError && error.label === label && error.ms === ms) {
      keepAlive(task);
    }
    throw error;
  }
}
