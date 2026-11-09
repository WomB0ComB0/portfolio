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

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { JSX } from 'react';
import { MagicCard } from '@/components/magicui/magic-card';
import { CardContent, CardHeader } from '@/components/ui/card';
import { reportApiFailure } from '@/lib/observability/report';
import { urlFor } from '@/lib/sanity/client';
import { loadPlaceById, type Place } from '@/lib/sanity/loaders';
import { constructMetadata } from '@/utils/seo/meta';
import { PlacePhotoViewer } from './_components/place-photo-viewer';
import { PlacePhotosEmptyState } from './_components/place-photos-empty-state';
import { PlaceSummary } from './_components/place-summary';
import { stripThumbUrl, viewerPhotoUrl } from './_components/viewer-photo-url';
import type { PlacePageProps, ViewerPhoto } from './page.types';

/** Groups this page's metadata fallbacks in Sentry (one event per cooldown window). */
const METADATA_REPORT_CONTEXT = 'build place page metadata';
/** The longest meta description, which search results show before cutting it themselves. */
const MAX_DESCRIPTION_LENGTH = 160;
const ELLIPSIS = '…';
/** The size of a link preview card. */
const PREVIEW_WIDTH = 1200;
const PREVIEW_HEIGHT = 630;
/** The viewer's photo box: each photo is scaled to fit it whole. */
const VIEWER_MAX_WIDTH = 1600;
const VIEWER_MAX_HEIGHT = 1200;
/** Punctuation and spaces left dangling where a description is cut. */
const DANGLING_END = /[\s,.;:!?–—-]+$/u;

/**
 * `text` on one line, cut at the last word that fits within {@link MAX_DESCRIPTION_LENGTH}
 * characters with the ellipsis. A single word longer than that is cut where it has to be.
 */
function metaDescription(text: string): string {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= MAX_DESCRIPTION_LENGTH) return oneLine;

  const room = MAX_DESCRIPTION_LENGTH - ELLIPSIS.length;
  // A space at index `room` ends a word that fits exactly, so the search starts there.
  const lastSpace = oneLine.lastIndexOf(' ', room);
  const kept = lastSpace > 0 ? oneLine.slice(0, lastSpace) : oneLine.slice(0, room);
  return `${kept.replace(DANGLING_END, '')}${ELLIPSIS}`;
}

/** The first photo as a link preview, or undefined for the generated card. */
const previewImage = (place: Place): string | undefined => {
  const [first] = place.photos ?? [];
  return first ? urlFor(first).width(PREVIEW_WIDTH).height(PREVIEW_HEIGHT).url() : undefined;
};

/**
 * The place's title, description and first photo. An unknown id gets "Place Not Found" without
 * og:url (the page answers 404). If Sanity is down with nothing cached, whether the id exists is
 * unknown, so the page keeps generic metadata (and its og:url) and the outage is reported.
 */
export async function generateMetadata({ params }: PlacePageProps): Promise<Metadata> {
  const { placeId } = await params;
  const path = `/places/${encodeURIComponent(placeId)}`;

  try {
    const place = await loadPlaceById(placeId);
    if (!place) {
      return constructMetadata({
        title: 'Place Not Found',
        description: 'The requested place could not be found',
      });
    }
    return constructMetadata({
      title: place.name,
      description: metaDescription(place.description),
      image: previewImage(place),
      path,
    });
  } catch (error) {
    reportApiFailure(error, { context: METADATA_REPORT_CONTEXT, level: 'warning' });
    return constructMetadata({ title: 'Places', description: 'A place I visited', path });
  }
}

/**
 * The viewer's photos: each whole (never cropped to the frame), with its strip thumbnail and its
 * alt text.
 */
const viewerPhotos = (place: Place): ViewerPhoto[] =>
  (place.photos ?? []).map((photo) => ({
    url: viewerPhotoUrl(photo.asset, VIEWER_MAX_WIDTH, VIEWER_MAX_HEIGHT),
    thumb: stripThumbUrl(photo),
    caption: photo.caption,
    alt: photo.caption || `Photo of ${place.name}`,
  }));

/** The place page's header content; the close link's name says what it closes. */
const placeSummary = (place: Place, closeLabel: string): JSX.Element => (
  <PlaceSummary
    name={place.name}
    category={place.category}
    description={place.description}
    startDate={place.startDate}
    endDate={place.endDate}
    closeLabel={closeLabel}
  />
);

/**
 * A place in full: its summary, then its photos, or an empty state with a map link when it has
 * none. An unknown id answers 404, and a Sanity outage with nothing cached reaches the shell's
 * error boundary.
 */
export default async function PlacePage({ params }: PlacePageProps): Promise<JSX.Element> {
  const { placeId } = await params;
  const place = await loadPlaceById(placeId);
  if (!place) notFound();

  const photos = viewerPhotos(place);

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="w-full max-w-7xl mx-auto">
        <MagicCard>
          {photos.length === 0 ? (
            <>
              <CardHeader>{placeSummary(place, 'Close')}</CardHeader>
              <CardContent>
                <PlacePhotosEmptyState latitude={place.latitude} longitude={place.longitude} />
              </CardContent>
            </>
          ) : (
            <PlacePhotoViewer
              photos={photos}
              placeName={place.name}
              summary={placeSummary(place, 'Close photo viewer')}
            />
          )}
        </MagicCard>
      </div>
    </div>
  );
}
