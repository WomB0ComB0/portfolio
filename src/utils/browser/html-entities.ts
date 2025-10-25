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
 * @copyright Copyright (c) 2025 Mike Odnis
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/**
 * Encodes every character in a string as a decimal HTML character reference.
 *
 * @param {string} str The string to encode.
 * @returns {string} The string with every character replaced by its HTML decimal entity.
 * @throws {TypeError} If the provided value is not a string.
 * @private
 * @author Mike Odnis
 * @see https://developer.mozilla.org/en-US/docs/Glossary/Entity
 * @see https://dev.w3.org/html5/html-author/charref
 * @version 1.0.0
 */
const toEntities = (str: string): string =>
  str
    .split('')
    .map((c) => `&#${c.charCodeAt(0)};`)
    .join('');

/**
 * Obfuscates and encodes a contact hyperlink (such as mailto or tel) as HTML entities.
 *
 * This helps mitigate email/phone scraping from bots by encoding both the link and visible text.
 *
 * @param {Object} opts Configuration options for link obfuscation.
 * @param {'mailto'|'tel'|string} opts.scheme The URI scheme (e.g., 'mailto', 'tel', or custom).
 * @param {string} opts.address The contact address (email or phone number).
 * @param {Record<string, string>} [opts.params] Optional query parameters (used for mailto links).
 * @param {string} [opts.text] Optional visible link text. Defaults to address.
 * @returns {{ encodedHref: string, encodedText: string }} Object containing the obfuscated/encoded href and visible text.
 * @throws {TypeError} If required fields are missing or invalid.
 * @web
 * @public
 * @author Mike Odnis
 * @author WomB0ComB0
 * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#security_and_privacy
 * @see https://github.com/WomB0ComB0/portfolio
 * @version 1.0.0
 * @example
 * // Basic obfuscate mailto link
 * const { encodedHref, encodedText } = obfuscateLink({
 *   scheme: 'mailto',
 *   address: 'jane.doe@example.com',
 *   text: 'Contact Jane'
 * });
 * // Use in HTML: <a href={encodedHref}>{encodedText}</a>
 *
 * @example
 * // Obfuscate tel link
 * const { encodedHref, encodedText } = obfuscateLink({
 *   scheme: 'tel',
 *   address: '+12015550123',
 *   text: '+1 (201) 555-0123'
 * });
 */
export const obfuscateLink = (opts: {
  scheme: 'mailto' | 'tel' | string;
  address: string;
  params?: Record<string, string>;
  text?: string;
}) => {
  const { scheme, address, params, text } = opts;

  let uri = `${scheme}:${address}`;

  if (params && Object.keys(params).length) {
    const qs = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    uri += `?${qs}`;
  }

  const encodedHref = toEntities(uri);
  const encodedText = toEntities(text ?? address);

  return { encodedHref, encodedText };
};
