
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

import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { logger } from '../logging';

/**
 * Sanitizes a string of HTML by removing malicious and unwanted tags and attributes
 * to prevent XSS attacks in web applications. Uses a recommended default set of dangerous tags and attributes,
 * but accepts additional configuration.
 *
 * @function
 * @public
 * @author Mike Odnis
 * @web
 * @param {string} html The HTML string to be sanitized.
 * @param {object} [options={}] Optional DOMPurify configuration object to extend or override default behavior.
 * @returns {string} A sanitized HTML string, safe for web rendering.
 * @see https://github.com/cure53/DOMPurify
 * @version 1.0.0
 * @example
 * const safeHtml = sanitizeHtml('<img src=x onerror=alert(1)>');
 */
export const sanitizeHtml = (html: string, options = {}): string => {
  if (!html || typeof html !== 'string') {
    return '';
  }

  const defaultOptions = {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'style', 'iframe', 'frame', 'object', 'embed'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
  };

  return DOMPurify.sanitize(html, { ...defaultOptions, ...options });
};

/**
 * Converts markdown input to HTML and sanitizes the resulting HTML to prevent XSS,
 * making it safe for web display.
 *
 * @async
 * @function
 * @public
 * @author Mike Odnis
 * @web
 * @param {string} markdown The markdown string to be converted and sanitized.
 * @param {object} [markedOptions={}] Optional 'marked' configuration options.
 * @returns {Promise<string>} Resolves to sanitized HTML string.
 * @throws {Error} If markdown parsing or sanitization fails.
 * @see https://marked.js.org/#/USING_ADVANCED.md
 * @version 1.0.0
 * @example
 * const safeHtml = await sanitizeMarkdown('**Hello** <img src="#" onerror="alert(1)">');
 */
export const sanitizeMarkdown = async (markdown: string, markedOptions = {}): Promise<string> => {
  if (!markdown || typeof markdown !== 'string') {
    return '';
  }

  try {
    const defaultOptions = {
      gfm: true,
      breaks: true,
      sanitize: true,
    };

    const htmlContent = await marked.parse(markdown, { ...defaultOptions, ...markedOptions });
    return sanitizeHtml(htmlContent);
  } catch (error) {
    logger.error('Error sanitizing markdown:', error);
    return '';
  }
};

/**
 * Validates and sanitizes a user-supplied URL, ensuring it conforms to allowed protocols
 * and is not a vector for injection attacks like `javascript:` or `data:`.
 *
 * @function
 * @public
 * @author Mike Odnis
 * @web
 * @param {string} url The URL to be validated and sanitized.
 * @param {string[]} [allowedProtocols=['http:', 'https:', 'mailto:']] Array of allowed URL protocols.
 * @returns {string} The sanitized URL if valid, or an empty string if unsafe.
 * @version 1.0.0
 * @example
 * const safeUrl = sanitizeUrl('https://example.com');
 * @example
 * // Prevents dangerous URLs
 * sanitizeUrl('javascript:alert(1)') // ''
 */
export const sanitizeUrl = (
  url: string,
  allowedProtocols = ['http:', 'https:', 'mailto:'],
): string => {
  if (!url || typeof url !== 'string') {
    return '';
  }

  url = url.trim();

  // Handle relative URLs
  if (url.startsWith('/') && !url.startsWith('//')) {
    return url;
  }

  try {
    const parsedUrl = new URL(url);
    if (allowedProtocols.includes(parsedUrl.protocol)) {
      // Additional check for potential script injection in hostname
      if (parsedUrl.hostname.includes('javascript:') || parsedUrl.hostname.includes('data:')) {
        return '';
      }
      return url;
    }
    return '';
  } catch {
    // If URL parsing fails, try checking if it's a relative path
    if (/^[a-zA-Z0-9/_.-]+$/.test(url) && !url.includes('javascript:') && !url.includes('data:')) {
      return url;
    }
    return '';
  }
};

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

  // Trim whitespace
  let sanitizedInput = input.trim();

  // Remove HTML tags if not allowed
  if (!allowHtml) {
    let previous;
    do {
      previous = sanitizedInput;
      sanitizedInput = sanitizedInput.replace(/<[^>]*>/g, '');
    } while (sanitizedInput !== previous);
  }

  // Normalize whitespace
  sanitizedInput = sanitizedInput.replace(/\s+/g, ' ');

  // Prevent null byte attacks
  // eslint-disable-next-line no-control-regex
  sanitizedInput = sanitizedInput.replace(/\u0000/g, '');

  // Prevent script injections in various forms
  sanitizedInput = sanitizedInput
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/vbscript:/gi, '');

  return sanitizedInput.slice(0, maxLength);
};

/**
 * Escapes special HTML characters in a string to their corresponding HTML entities,
 * preventing direct injection of HTML and JavaScript when rendering untrusted content.
 *
 * @function
 * @public
 * @author Mike Odnis
 * @param {string} text The plain text to escape.
 * @returns {string} The escaped string safe for HTML rendering.
 * @version 1.0.0
 * @see https://developer.mozilla.org/en-US/docs/Glossary/Entity
 * @example
 * escapeHtml('<script>alert("xss")</script>'); // "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"
 */
export const escapeHtml = (text: string): string => {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * Sanitizes and safely parses a JSON string, removing suspicious syntax elements that could
 * potentially result in JSON polyglot exploits or prototype pollution. Use for parsing
 * untrusted JSON input.
 *
 * @template T
 * @function
 * @public
 * @author Mike Odnis
 * @param {string} jsonString The JSON string to sanitize and parse.
 * @returns {T|null} The parsed JavaScript object if valid, or `null` if invalid.
 * @throws {SyntaxError} If JSON parsing fails.
 * @version 1.0.0
 * @see https://portswigger.net/research/polyglot-javascript
 * @example
 * const obj = sanitizeJson<{ foo: string }>('{"foo":"bar"}');
 */
export const sanitizeJson = <T>(jsonString: string): T | null => {
  if (!jsonString || typeof jsonString !== 'string') {
    return null;
  }

  try {
    // Remove potential executable code patterns
    const sanitized = jsonString
      .replace(/\)\s*\{/g, ') {}') // Prevent function execution patterns
      .replace(/\]\s*\{/g, '] {}')
      .replace(/\}\s*\{/g, '} {}');

    return JSON.parse(sanitized) as T;
  } catch (error) {
    console.error('Error parsing JSON:', error);
    return null;
  }
};

