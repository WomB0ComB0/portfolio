'use client';

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
 * @file The /projects hover preview (the hover-image-links pattern, our own rewrite; the owner's
 * "Keep A + no lean"). It wraps the Index's groups (never the filter bar, so a pointer over the
 * stuck bar has left) and shows the cover of the row marked `data-preview-id` under the pointer
 * or keyboard focus. Its markup is only this wrapper, so the server HTML and hydration are the
 * same on every device. The card, its listeners and motion's animate() live in
 * project-preview-live.tsx, loaded lazily on a fine pointer only: touch adds nothing, not even
 * a request for that code or a cover, and /projects' first load carries none of it.
 */

import { lazy, type ReactElement, type ReactNode, Suspense, useRef } from 'react';

import { useFinePointer } from '@/hooks/use-fine-pointer';
import type { PreviewItem } from '../_lib/project-index';

/** The card and its listeners, fetched the first time a fine pointer is seen. */
const LivePreview = lazy(() =>
  import('./project-preview-live').then((module) => ({ default: module.LivePreview })),
);

export interface ProjectPreviewProps {
  /** Each row's card, by its `data-preview-id`. */
  readonly items: Readonly<Record<string, PreviewItem>>;
  /** Changes on any filter or URL change (the URL, then the rows shown): the card hides at once. */
  readonly resetOn: string;
  readonly children: ReactNode;
}

/** The rows, and (on a fine pointer) the card that previews the one under the pointer or focus. */
export function ProjectPreview({ items, resetOn, children }: ProjectPreviewProps): ReactElement {
  const fine = useFinePointer();
  const rootRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={rootRef} data-hover-preview={fine ? 'on' : 'off'}>
      {children}
      {fine && (
        <Suspense fallback={null}>
          <LivePreview rootRef={rootRef} items={items} resetOn={resetOn} />
        </Suspense>
      )}
    </div>
  );
}
