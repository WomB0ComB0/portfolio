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
 * @file The one web-address check for a project's Live and Code links: only http and https
 * addresses are kept, as Studio wrote them (trimmed); anything else gives no link. Synthetic
 * addresses only.
 */

import { describe, expect, it } from 'vitest';

import { safeHref, webUrl } from '@/app/(routes)/(main)/(professioal)/projects/_lib/project-links';

describe('safeHref', () => {
  it('keeps a real web address as written, trimmed', () => {
    expect(safeHref('https://github.com/example/grepo')).toBe('https://github.com/example/grepo');
    expect(safeHref('  http://demo.example/path?x=1 ')).toBe('http://demo.example/path?x=1');
  });

  it('drops anything that is not an http or https address', () => {
    expect(safeHref('javascript:alert(1)')).toBeNull();
    expect(safeHref('data:text/html,hi')).toBeNull();
    expect(safeHref('ftp://files.example')).toBeNull();
    expect(safeHref('demo.example')).toBeNull();
    expect(safeHref('not a url')).toBeNull();
    expect(safeHref('')).toBeNull();
    expect(safeHref(null)).toBeNull();
    expect(safeHref(undefined)).toBeNull();
  });

  it('drops an address without the slashes after its scheme, which would stay on this site', () => {
    // The URL parser reads both as https://example.com/, but in an href on this site they
    // resolve against the page: /projects/example.com and /example.com.
    expect(safeHref('https:example.com')).toBeNull();
    expect(safeHref('https:/example.com')).toBeNull();
    expect(safeHref('http:demo.example/path')).toBeNull();
  });

  it('takes the scheme in any case, as the URL parser does', () => {
    expect(safeHref('HTTPS://demo.example/a')).toBe('HTTPS://demo.example/a');
  });
});

describe('webUrl', () => {
  it('parses a web address, and nothing else', () => {
    expect(webUrl('https://www.demo.example/a')?.hostname).toBe('www.demo.example');
    expect(webUrl('mailto:someone@example.com')).toBeNull();
  });

  it('agrees with safeHref on an address without the slashes, so no host is named for it', () => {
    expect(webUrl('https:example.com')).toBeNull();
    expect(webUrl('https:/example.com')).toBeNull();
  });
});
