/**
 * Copyright (c) 2025 Mike Odnis
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

// Encode every character as a decimal HTML character reference.
const toEntities = (str: string) =>
  str
    .split('')
    .map((c) => `&#${c.charCodeAt(0)};`)
    .join('');

/**
 * Build and obfuscate an href for "mailto:", "tel:", etc.
 * opts = {
 *   scheme: "mailto" | "tel" | string,
 *   address: string,          // email or phone
 *   params?: Record<string,string>, // optional query params for mailto:
 *   text?: string             // optional visible text; defaults to address
 * }
 * const { encodedHref: tHref, encodedText: tText } = obfuscateLink({
  scheme: "tel",
  address: "+12015550123",
  text: "+1 (201) 555-0123"
});
 */
export const obfuscateLink = (opts: {
  scheme: 'mailto' | 'tel' | string;
  address: string;
  params?: Record<string, string>;
  text?: string;
}) => {
  const { scheme, address, params, text } = opts;

  // Build the URI
  let uri = `${scheme}:${address}`;

  // If we have params (e.g., mailto subject/body), percent-encode them
  if (params && Object.keys(params).length) {
    const qs = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    uri += `?${qs}`;
  }

  // Entity-encode the full href (including the scheme) and the visible text
  const encodedHref = toEntities(uri);
  const encodedText = toEntities(text ?? address);

  return { encodedHref, encodedText };
};
