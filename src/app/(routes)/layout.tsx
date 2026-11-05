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

import { PageEnter } from '@/components/animations/pages/page-enter';
import { Layout } from '@/components/layout/layout';

/**
 * The site shell for every route: skip link, command palette, navs, footer and the one `<main>`.
 *
 * Next keeps this layout mounted across client navigations between its routes, so the shell
 * mounts once (the palette's actions stay registered, the navs and footer keep their state);
 * only the page under PageEnter changes, and fades in. Pages must not render a Layout of their own.
 */
export default function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <Layout>
      <PageEnter>{children}</PageEnter>
    </Layout>
  );
}
