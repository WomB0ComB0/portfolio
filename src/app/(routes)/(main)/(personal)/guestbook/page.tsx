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
import { constructMetadata } from '@/utils';

export const metadata = constructMetadata({
  title: 'Guestbook',
  description: 'Sign my guestbook and leave a message!',
  path: '/guestbook',
});

/**
 * Guestbook page component.
 * Renders the guestbook interface for users to leave messages. The interface is imported directly
 * (no next/dynamic); its client island handles sign-in and the messages. The page awaits nothing,
 * so it has no loading.tsx; the island shows its own sign-in card and message skeleton while the
 * messages load.
 *
 * @returns {JSX.Element} The guestbook page.
 * @author Mike Odnis
 * @version 1.0.0
 */
const GuestbookPage = (): JSX.Element => {
  return <Guestbook />;
};
GuestbookPage.displayName = 'GuestbookPage';
export default GuestbookPage;
