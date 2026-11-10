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
 * @file The open view's place in the page (the #632 lazy pattern): nothing until a photo is
 * opened. Its code (the Radix dialog and motion's animate) lives in photo-dialog-live.tsx,
 * fetched early on a first sign of intent (a pointer over or focus in the wall or the grid) and
 * at the latest on the first open. A chunk that fails to load resolves to DialogUnavailable,
 * which sends the visitor on to the photo's place page (which has every photo of that visit)
 * and tells the view to leave later clicks to the links themselves.
 */

import { useRouter } from 'next/navigation';
import { type ComponentType, lazy, type ReactElement, Suspense, useEffect } from 'react';

import type { LivePhotoDialogProps } from './photo-dialog-live';
import type { OpenRequest } from './photo-types';

interface Unavailable {
  /** Called once if the open view's code can't load. */
  readonly onUnavailable: () => void;
}

type ChunkProps = LivePhotoDialogProps & Unavailable;

/** Fetches the open view's code; the same module every time. */
const loadDialog = () => import('./photo-dialog-live');

/** Starts fetching the open view's code, so the first open has it. Failures wait for the open. */
export function preloadPhotoDialog(): void {
  loadDialog().catch(() => undefined);
}

/** Stands in for an open view whose code failed to load: opens the photo's place page instead. */
function DialogUnavailable({ opened, onUnavailable }: ChunkProps): null {
  const router = useRouter();
  useEffect(() => {
    onUnavailable();
    router.push(`/places/${encodeURIComponent(opened.photo.placeId)}`);
  }, [onUnavailable, opened, router]);
  return null;
}

/**
 * The open view, fetched on intent or on the first open. lazy() rethrows a rejected import
 * during render and Suspense doesn't catch errors, so a failed chunk resolves to
 * DialogUnavailable.
 */
const LiveDialogChunk = lazy<ComponentType<ChunkProps>>(() =>
  loadDialog().then(
    (module) => ({ default: module.LivePhotoDialog }),
    () => ({ default: DialogUnavailable }),
  ),
);

export interface PhotoDialogProps extends Unavailable {
  /** The photo open, or null. */
  readonly opened: OpenRequest | null;
  /** The view closed (it has landed back in its card): forget the photo. */
  readonly onClosed: () => void;
}

/** The open photo, when there is one. */
export function PhotoDialog({
  opened,
  onClosed,
  onUnavailable,
}: PhotoDialogProps): ReactElement | null {
  if (!opened) return null;
  return (
    <Suspense fallback={null}>
      <LiveDialogChunk opened={opened} onClosed={onClosed} onUnavailable={onUnavailable} />
    </Suspense>
  );
}
