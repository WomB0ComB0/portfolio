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

import type { JSX } from 'react';
import { Guestbook } from '@/app/(routes)/(main)/(personal)/guestbook/_interface';
import { loadGuestbook } from '@/lib/guestbook/messages';
import { constructMetadata } from '@/utils';

export const metadata = constructMetadata({
  title: 'Guestbook',
  description: 'Sign my guestbook and leave a message!',
  path: '/guestbook',
});

/**
 * Guestbook page. Loads every message on the server (src/lib/guestbook/messages.ts: a shared
 * stale-on-error cache with a deadline), so the list is in the HTML. The loader never throws: a
 * failed load renders the page's own error state, with the sign-in card still there. There is no
 * loading.tsx, as on /certifications: the page renders once the loader answers.
 *
 * @returns {Promise<JSX.Element>} The guestbook page.
 */
export default async function GuestbookPage(): Promise<JSX.Element> {
  const load = await loadGuestbook();
  return <Guestbook load={load} />;
}
