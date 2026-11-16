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
 * @file The one web-address check for a project's links (its live site and its code), pure and
 * server-safe: Studio's free-text URL fields are kept only when they are real http or https
 * addresses, so a mistyped value gives no link rather than a broken one, and a `javascript:` or
 * `data:` value never reaches an href. /projects builds every entry's Live and Code links with
 * it; a project page can read the same rule from here.
 */

const tidy = (text: string | null | undefined): string => (text ?? '').replace(/\s+/gu, ' ').trim();

/**
 * A whole web address starts with its scheme and '//'. The URL parser also reads
 * 'https:example.com' as https://example.com/, but a link written that way resolves against the
 * page it sits on ('https:/example.com' on https://mikeodnis.dev/projects/x opens
 * https://mikeodnis.dev/example.com), so the link Studio holds is only kept with the slashes.
 */
const WEB_ADDRESS = /^https?:\/\//iu;

/** The address as a URL when it is a whole web address (http:// or https://), else null. */
export function webUrl(value: string | null | undefined): URL | null {
  const text = tidy(value);
  if (!WEB_ADDRESS.test(text)) return null;
  try {
    const url = new URL(text);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null;
  } catch {
    return null;
  }
}

/**
 * A link Studio holds, as Studio wrote it (trimmed), kept only when it is a whole web address, so
 * the href always leaves the site for the address it reads.
 *
 * @example
 * safeHref(' https://github.com/example/grepo ') // 'https://github.com/example/grepo'
 * safeHref('https:example.com') // null
 * safeHref('javascript:alert(1)') // null
 */
export const safeHref = (value: string | null | undefined): string | null =>
  webUrl(value) ? tidy(value) : null;
