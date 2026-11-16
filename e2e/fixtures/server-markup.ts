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

/** Site-wide navigation, no-JavaScript page links, JSON-LD and 404 robots, extracted from the approved route lab. Media CollectionPage and route-specific content checks remain in their owning route changes. */
import { createRequire } from 'node:module';

// The existing test dependency has no declarations installed; only its DOM fragment API is used.
const { JSDOM } = createRequire(import.meta.url)('jsdom') as {
  JSDOM: { fragment: (html: string) => DocumentFragment };
};

/**
 * A response's HTML without its script elements, whose payload repeats the page as text, and
 * without its noscript blocks: the page list in one (src/components/layout/noscript-nav.tsx) is
 * for a visitor without JavaScript, and a crawler that renders the page never sees it. Left in,
 * its links would pass the rail's check below on the rail's behalf.
 */
export function markupOf(html: string): string {
  // Fragment parsing is inert: no scripts run, and no remote resources load.
  const fragment = JSDOM.fragment(html);
  for (const element of fragment.querySelectorAll('script, noscript')) element.remove();
  const container = fragment.ownerDocument.createElement('div');
  container.append(fragment);
  return container.innerHTML;
}
