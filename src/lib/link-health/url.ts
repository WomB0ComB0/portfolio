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

/** Browser-safe identity only; DNS/address safety is enforced again by the server probe. */
export function normalizeLinkUrl(value: unknown): string | null {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: reject controls that WHATWG URL would silently strip.
  if (typeof value !== 'string' || value.length > 2048 || /[\u0000-\u001f\u007f\\]/u.test(value))
    return null;
  const input = value.trim();
  if (!/^https?:\/\//iu.test(input)) return null;
  try {
    const url = new URL(input);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port)
      return null;
    url.hash = '';
    return url.href.length <= 2048 ? url.href : null;
  } catch {
    return null;
  }
}
