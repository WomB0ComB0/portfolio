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

import { constructMetadata } from '@/utils';
import dynamic from 'next/dynamic';
import type { JSX } from 'react';

const Guestbook = dynamic(
  () =>
    import('@/app/(routes)/(main)/(personal)/guestbook/_interface/guestbook').then(
      (mod) => mod.Guestbook,
    ),
  {
    ssr: true,
  },
);

export const metadata = constructMetadata({
  title: 'Guestbook',
  description: 'Sign my guestbook and leave a message!',
});

/**
 * Guestbook page component.
 * Renders the guestbook interface for users to leave messages.
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
