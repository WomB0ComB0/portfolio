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
import { FiExternalLink, FiImage, FiInfo, FiMapPin } from 'react-icons/fi';
import { MagicCard } from '@/components/magicui';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { PlaceItem } from '@/types/places';
import { googleMapsUrl } from './google-maps-url';
import { PlaceCategoryBadge } from './place-category-badge';
import { PlaceDateRange } from './place-date-range';

interface PlaceCardProps {
  place: PlaceItem;
}

/**
 * A place in the /places list. The header opens the location in Google Maps. The footer opens the
 * place page: its photos, or, for places without any, the full description the card cuts off.
 */
export function PlaceCard({ place }: PlaceCardProps) {
  const photoCount = place.photos?.length ?? 0;

  return (
    <MagicCard className="backdrop-blur-sm border-border/50 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 group h-full">
      <div className="flex flex-col h-full">
        <CardHeader className="pb-4 grow">
          <Link
            href={googleMapsUrl(place.latitude, place.longitude)}
            target="_blank"
            className="w-full block group/link"
            rel="noopener noreferrer"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <CardTitle className="text-lg text-foreground group-hover/link:text-primary transition-colors flex items-center gap-2">
                <FiMapPin className="h-4 w-4 shrink-0" />
                <span className="line-clamp-1">{place.name}</span>
              </CardTitle>
              <FiExternalLink className="h-4 w-4 text-muted-foreground group-hover/link:text-primary shrink-0 mt-0.5 opacity-0 group-hover/link:opacity-100 transition-opacity" />
            </div>
            <CardDescription className="text-sm text-muted-foreground leading-snug mb-3 line-clamp-2">
              {place.description}
            </CardDescription>
            <div className="flex flex-wrap items-center gap-2">
              <PlaceCategoryBadge category={place.category} />
              <PlaceDateRange
                startDate={place.startDate}
                endDate={place.endDate}
                className="text-xs text-muted-foreground"
              />
            </div>
          </Link>
        </CardHeader>
        <CardContent className="pt-0 pb-5 px-6 mt-auto">
          <Link
            href={`/places/${place.id}`}
            className="w-full px-4 py-2.5 rounded-xl border border-border/50 bg-secondary/50 hover:bg-secondary hover:border-primary/30 text-foreground transition-colors duration-300 flex items-center justify-center gap-2.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {photoCount > 0 ? (
              <>
                <FiImage className="h-4 w-4" aria-hidden="true" />
                View Photos ({photoCount})
              </>
            ) : (
              <>
                <FiInfo className="h-4 w-4" aria-hidden="true" />
                View Details
              </>
            )}
            {/* Every card has this link; the place's name tells them apart in a links list
                ("View Details for Antler NYC"). A word, not punctuation, because browsers add
                a space before this absolutely positioned span when they build the name. */}{' '}
            <span className="sr-only">for {place.name}</span>
          </Link>
        </CardContent>
      </div>
    </MagicCard>
  );
}
