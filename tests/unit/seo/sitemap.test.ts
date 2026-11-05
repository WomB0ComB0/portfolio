// @vitest-environment node
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

/** @file The sitemap lists every public page, /stats included, in one shape. */

import { afterAll, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  // app.url is read from this variable when the constants module loads.
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://mikeodnis.dev');
});

import Sitemap from '@/app/sitemap';

afterAll(() => {
  vi.unstubAllEnvs();
});

describe('sitemap', () => {
  it('lists /stats', async () => {
    const urls = (await Sitemap()).map((entry) => entry.url);

    expect(urls).toContain('https://mikeodnis.dev/stats');
  });

  it('gives every entry an absolute URL on the site and a lastModified date', async () => {
    const entries = await Sitemap();

    for (const entry of entries) {
      expect(new URL(entry.url).origin).toBe('https://mikeodnis.dev');
      expect(entry.lastModified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(new Set(entries.map((entry) => entry.url)).size).toBe(entries.length);
  });
});
