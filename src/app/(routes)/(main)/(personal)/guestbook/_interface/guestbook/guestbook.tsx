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
import { GuestbookComponent } from '@/app/(routes)/(main)/(personal)/guestbook/_components';
import Layout from '@/components/layout/layout';

/**
 * Guestbook component.
 * Renders the guestbook interface where users can leave messages.
 *
 * @returns {JSX.Element} The guestbook view.
 * @author Mike Odnis
 * @version 1.0.0
 */
export const Guestbook = (): JSX.Element => {
  return (
    <Layout>
      <div className="w-full min-h-screen h-full p-8 flex flex-col items-center relative">
        <section className="flex flex-col w-full justify-between mt-16 lg:mt-0 md:mt-0 prose mb-10">
          <h1 className="dark:text-zinc-200 text-[#ba9bdd] leading-none mb-3 sr-only">Guestbook</h1>
          <GuestbookComponent />
        </section>
      </div>
    </Layout>
  );
};
Guestbook.displayName = 'Guestbook';
export default Guestbook;
