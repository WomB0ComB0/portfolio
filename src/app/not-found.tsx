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
 * @fileoverview The 404 page for unmatched URLs.
 *
 * Unmatched URLs render inside the root layout but outside route-group layouts, so they need
 * their own shell. The server-action 404 fallback omits the root layout and its providers;
 * RootNotFoundShell handles that case without mounting the shell's context consumers.
 * notFound() under (routes) uses that group's not-found.tsx inside the existing shell.
 */

import type { JSX } from 'react';
import { NotFoundView } from '@/app/_components/errors';
import { RootNotFoundShell } from '@/app/_components/errors/root-not-found-shell';
import { NOT_FOUND_METADATA } from '@/app/(routes)/not-found';
import { Layout } from '@/components/layout/layout';

export const metadata = NOT_FOUND_METADATA;

export default function NotFoundPage(): JSX.Element {
  return (
    <RootNotFoundShell>
      <Layout>
        <NotFoundView />
      </Layout>
    </RootNotFoundShell>
  );
}
