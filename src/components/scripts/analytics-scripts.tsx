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

import { GoogleAnalytics } from '@next/third-parties/google';
import { env } from '@/env';

/**
 * Injects Google Analytics 4 (GA4) script for analytics.
 * Uses the official `@next/third-parties/google` component.
 *
 * @returns {JSX.Element | null} The GA4 script tag or null if Measurement ID is not configured.
 */
export function AnalyticsScripts({ nonce }: { nonce: string | undefined }) {
  if (!env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID) {
    return null;
  }

  return <GoogleAnalytics gaId={env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID} nonce={nonce} />;
}
