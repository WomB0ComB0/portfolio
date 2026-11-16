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
 * @file JSON-LD as native script elements, rendered on the server.
 *
 * Not next/script: that component injects its script in the browser, so the JSON-LD was in no
 * page's server HTML and a crawler that runs no JavaScript never saw it. A JSON-LD block is
 * data, which no browser executes, so it needs no loading strategy. No client directive either:
 * these are server components and add nothing to the client bundle.
 */

import type { JSX } from 'react';
import { type JsonLdDocument, serializeJsonLd, siteJsonLd } from '@/lib/seo/json-ld';

export interface JsonLdProps {
  /** The JSON-LD to write, built in src/lib/seo/json-ld.ts. */
  readonly data: JsonLdDocument;
  readonly id?: string;
  /** The request's CSP nonce, when the layout has one. */
  readonly nonce?: string;
}

/** One JSON-LD block. React would HTML-escape the quotes of a text child, so the JSON is raw. */
export function JsonLd({ data, id, nonce }: JsonLdProps): JSX.Element {
  return (
    <script
      id={id}
      type="application/ld+json"
      nonce={nonce}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: the text is JSON.stringify output of the site's own constants with every "<" escaped (serializeJsonLd), as Next's JSON-LD guide shows.
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}

/** Every page's JSON-LD: the Person the site is about and the WebSite, for the root layout. */
export function StructuredData({ nonce }: Readonly<{ nonce: string | undefined }>): JSX.Element {
  return <JsonLd id="structured-data" data={siteJsonLd()} nonce={nonce} />;
}
