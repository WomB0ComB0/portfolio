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

'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';

/**
 * A component that lazy-loads the Google Maps JavaScript API.
 * It should be used on pages that display a Google Map.
 *
 * @returns {JSX.Element | null} The Google Maps script tag or null.
 */
export function LazyMapsLoader() {
  const [mapsApiKey, setMapsApiKey] = useState<string>('');

  useEffect(() => {
    // Dynamically import the config to get the API key on the client-side.
    import('@/config').then((mod) => {
      const key = mod.config.google.maps.apiKey;
      if (key) {
        setMapsApiKey(key);
      }
    });
  }, []);

  if (!mapsApiKey) {
    return null;
  }

  return (
    <Script
      id="google-maps-api"
      strategy="lazyOnload"
      src={`https://maps.googleapis.com/maps/api/js?key=${mapsApiKey}&libraries=maps,marker&v=beta`}
    />
  );
}
