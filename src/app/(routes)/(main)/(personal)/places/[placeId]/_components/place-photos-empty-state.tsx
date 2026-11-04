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

import Link from 'next/link';
import { FiArrowLeft, FiExternalLink, FiImage } from 'react-icons/fi';
import { googleMapsUrl } from '@/app/(routes)/(main)/(personal)/places/_components/google-maps-url';
import { Button } from '@/components/ui/button';

interface PlacePhotosEmptyStateProps {
  latitude: number;
  longitude: number;
}

/** Stands in for the photo viewer on a place page that has no photos (yet). */
export function PlacePhotosEmptyState({ latitude, longitude }: PlacePhotosEmptyStateProps) {
  return (
    <section
      aria-labelledby="place-photos-empty-heading"
      className="flex flex-col items-center gap-5 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 px-6 py-14 text-center"
    >
      <span
        aria-hidden="true"
        className="flex h-14 w-14 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary"
      >
        <FiImage className="h-6 w-6" />
      </span>
      <div className="space-y-2">
        <h2 id="place-photos-empty-heading" className="text-xl font-semibold leading-tight">
          No photos yet
        </h2>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
          There aren&apos;t any photos from this place yet.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {/* text-foreground: the global a rule would otherwise make these labels low-contrast purple. */}
        <Button asChild variant="outline" className="text-foreground">
          <Link href={googleMapsUrl(latitude, longitude)} target="_blank" rel="noopener noreferrer">
            <FiExternalLink className="h-4 w-4" aria-hidden="true" />
            Open in Google Maps
          </Link>
        </Button>
        <Button asChild variant="ghost" className="text-foreground">
          <Link href="/places">
            <FiArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to Places
          </Link>
        </Button>
      </div>
    </section>
  );
}
