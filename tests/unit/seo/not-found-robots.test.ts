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
 * @file Every 404 carries one robots tag. Next writes `<meta name="robots" content="noindex">`
 * on each one itself: for a 404 status (app-render's NonIndex) and for notFound() thrown after the
 * page began to stream (make-get-server-inserted-html). The 404 metadata adding
 * `robots: { index: false, follow: false }` gave every 404 a second, 'noindex, nofollow' tag.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { NOT_FOUND_METADATA } from '@/app/(routes)/not-found';

const nextFile = (path: string): string =>
  readFileSync(join(process.cwd(), 'node_modules/next/dist', path), 'utf8');

describe('the 404 metadata and the robots tag', () => {
  it('asks for no robots tag of its own', () => {
    expect(NOT_FOUND_METADATA).not.toHaveProperty('robots');
  });

  it('keeps the "404" title and its description', () => {
    expect(NOT_FOUND_METADATA.title).toEqual(expect.objectContaining({ default: '404' }));
    expect(NOT_FOUND_METADATA.description).toBe('This page does not exist');
  });

  // If Next ever stops writing its own, the 404 metadata must ask for noindex again.
  it("relies on Next's own noindex, for a 404 status and for a notFound() after the flush", () => {
    expect(nextFile('server/app-render/app-render.js')).toMatch(
      /function NonIndex[\s\S]{0,600}name: 'robots',\s*content: 'noindex'/,
    );
    expect(nextFile('server/app-render/make-get-server-inserted-html.js')).toMatch(
      /isHTTPAccessFallbackError\)\(error\)[\s\S]{0,200}name: "robots",\s*content: "noindex"/,
    );
  });
});
