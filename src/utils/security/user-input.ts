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
 * @file validateUserInput on its own, with no imports: a client island that only checks typed
 * text (the guestbook's compose box) imports it from here and ships none of DOMPurify or marked,
 * which only sanitizeHtml and sanitizeMarkdown in ./xss need. ./xss re-exports it, so its callers
 * are unchanged.
 */

/** How much of the input validateUserInput sanitises, as a multiple of maxLength, with a floor. */
const INPUT_BOUND_FACTOR = 4;
const MIN_INPUT_BOUND = 256;
/** URL schemes that can carry script, removed from typed text. */
const SCRIPT_SCHEMES = /javascript:|data:|vbscript:/gi;

const inputBound = (maxLength: number): number =>
  Math.max(maxLength * INPUT_BOUND_FACTOR, MIN_INPUT_BOUND);

/**
 * Validates and sanitizes generic user input by trimming, removing HTML tags (unless allowed), normalizing whitespace,
 * and removing dangerous patterns to prevent XSS and basic injection flaws.
 *
 * @function
 * @public
 * @author Mike Odnis
 * @param {string} input User input to validate and sanitize.
 * @param {number} [maxLength=500] Maximum allowed input length. Excess will be truncated.
 * @param {boolean} [allowHtml=false] If true, HTML tags are preserved; otherwise, all tags are stripped.
 * @returns {string} Sanitized input string with length at most `maxLength`.
 * @version 1.0.0
 * @example
 * const clean = validateUserInput('<p>Hello!</p>', 50); // "Hello!"
 */
export const validateUserInput = (input: string, maxLength = 500, allowHtml = false): string => {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Trim whitespace, then bound the work. The tag-strip below is quadratic on a long run of
  // unclosed '<', and callers pass text from the URL (?q) that the server renders, so an oversized
  // value must not reach it whole. The slack over maxLength lets tags and runs of whitespace that
  // straddle the cut still be removed before the final slice, so typed input comes out the same.
  let sanitizedInput = input.trim().slice(0, inputBound(maxLength));

  // Remove HTML tags if not allowed
  if (!allowHtml) {
    let previousSanitizedInput: string;
    do {
      previousSanitizedInput = sanitizedInput;
      sanitizedInput = sanitizedInput.replaceAll(/<[^>]*>/g, '');
    } while (sanitizedInput !== previousSanitizedInput);
  }

  // Normalize whitespace
  sanitizedInput = sanitizedInput.replaceAll(/\s+/g, ' ');

  // Prevent script injections in various forms. Repeated until none is left, as the tag strip is:
  // removing one scheme can join the text around it into another (`javajavascript:script:`).
  let previousSchemeInput: string;
  do {
    previousSchemeInput = sanitizedInput;
    sanitizedInput = sanitizedInput.replaceAll(SCRIPT_SCHEMES, '');
  } while (sanitizedInput !== previousSchemeInput);

  return sanitizedInput.slice(0, maxLength);
};
