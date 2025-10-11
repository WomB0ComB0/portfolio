/**
 * Copyright 2025 Product Decoder
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

/**
 * Sanitizes HTML content to prevent XSS attacks
 * @param html - The HTML string to sanitize
 * @param options - Optional DOMPurify configuration
 * @returns Sanitized HTML string
 */
export const sanitizeHtml = (html: string, options = {}): string => {
  if (!html || typeof html !== 'string') {
    return '';
  }

  const defaultOptions = {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'style', 'iframe', 'frame', 'object', 'embed'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover']
  };

  return DOMPurify.sanitize(html, { ...defaultOptions, ...options });
};

/**
 * Converts markdown to HTML and sanitizes the result
 * @param markdown - The markdown string to process
 * @param markedOptions - Optional marked configuration
 * @returns Promise resolving to sanitized HTML
 */
export const sanitizeMarkdown = async (markdown: string, markedOptions = {}): Promise<string> => {
  if (!markdown || typeof markdown !== 'string') {
    return '';
  }

  try {
    const defaultOptions = {
      gfm: true,
      breaks: true,
      sanitize: true
    };

    const htmlContent = await marked.parse(markdown, { ...defaultOptions, ...markedOptions });
    return sanitizeHtml(htmlContent);
  } catch (error) {
    console.error('Error sanitizing markdown:', error);
    return '';
  }
};

/**
 * Validates and sanitizes URLs
 * @param url - The URL to sanitize
 * @param allowedProtocols - List of allowed protocols
 * @returns Sanitized URL or empty string if invalid
 */
export const sanitizeUrl = (url: string, allowedProtocols = ['http:', 'https:', 'mailto:']): string => {
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
 * Validates and sanitizes user input
 * @param input - The user input to validate
 * @param maxLength - Maximum allowed length
 * @param allowHtml - Whether to allow HTML (defaults to false)
 * @returns Sanitized input string
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
 * Escapes HTML special characters in a string
 * @param text - Text to escape
 * @returns Escaped string
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
 * Sanitizes JSON input before parsing
 * @param jsonString - JSON string to sanitize
 * @returns Parsed object or null if invalid
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
