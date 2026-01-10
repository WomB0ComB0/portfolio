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
 * @file XSS Security Tests
 * @description Unit tests for XSS prevention and input sanitization utilities.
 */

import { describe, expect, it } from 'vitest';

import { sanitizeHtml, sanitizeUrl } from '../../../src/utils/security/xss';

describe('XSS Security', () => {
  describe('sanitizeHtml', () => {
    it('removes script tags', () => {
      const malicious = '<script>alert("xss")</script><p>Safe content</p>';
      const result = sanitizeHtml(malicious);
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert');
      expect(result).toContain('<p>Safe content</p>');
    });

    it('removes event handlers', () => {
      const malicious = '<img src="x" onerror="alert(1)">';
      const result = sanitizeHtml(malicious);
      expect(result).not.toContain('onerror');
      expect(result).not.toContain('alert');
    });

    it('removes iframe tags', () => {
      const malicious = '<iframe src="https://evil.com"></iframe>';
      const result = sanitizeHtml(malicious);
      expect(result).not.toContain('<iframe');
    });

    it('preserves safe HTML', () => {
      const safe = '<p>Hello <strong>World</strong></p>';
      const result = sanitizeHtml(safe);
      expect(result).toBe(safe);
    });

    it('preserves links with safe attributes', () => {
      const safe = '<a href="https://example.com">Link</a>';
      const result = sanitizeHtml(safe);
      expect(result).toContain('href="https://example.com"');
    });

    it('handles empty input', () => {
      expect(sanitizeHtml('')).toBe('');
    });

    it('handles null/undefined gracefully', () => {
      // @ts-expect-error Testing invalid input
      expect(sanitizeHtml(null)).toBe('');
      // @ts-expect-error Testing invalid input
      expect(sanitizeHtml(undefined)).toBe('');
    });

    it('removes style tags', () => {
      const malicious = '<style>body { display: none; }</style><p>Content</p>';
      const result = sanitizeHtml(malicious);
      expect(result).not.toContain('<style>');
    });

    it('removes object and embed tags', () => {
      const malicious = '<object data="malware.swf"></object><embed src="malware.swf">';
      const result = sanitizeHtml(malicious);
      expect(result).not.toContain('<object');
      expect(result).not.toContain('<embed');
    });

    it('handles nested malicious content', () => {
      const malicious = '<div><p onclick="evil()">Text<script>bad()</script></p></div>';
      const result = sanitizeHtml(malicious);
      expect(result).not.toContain('onclick');
      expect(result).not.toContain('<script>');
      expect(result).toContain('<div>');
      expect(result).toContain('Text');
    });
  });

  describe('sanitizeUrl', () => {
    it('allows http URLs', () => {
      const url = 'http://example.com/page';
      const result = sanitizeUrl(url);
      expect(result).toBe(url);
    });

    it('allows https URLs', () => {
      const url = 'https://example.com/page';
      const result = sanitizeUrl(url);
      expect(result).toBe(url);
    });

    it('allows mailto URLs', () => {
      const url = 'mailto:test@example.com';
      const result = sanitizeUrl(url);
      expect(result).toBe(url);
    });

    it('blocks javascript: URLs', () => {
      const malicious = 'javascript:alert(1)';
      const result = sanitizeUrl(malicious);
      expect(result).toBe('');
    });

    it('blocks data: URLs', () => {
      const malicious = 'data:text/html,<script>alert(1)</script>';
      const result = sanitizeUrl(malicious);
      expect(result).toBe('');
    });

    it('blocks vbscript: URLs', () => {
      const malicious = 'vbscript:msgbox("xss")';
      const result = sanitizeUrl(malicious);
      expect(result).toBe('');
    });

    it('handles case variations', () => {
      const malicious = 'JAVASCRIPT:alert(1)';
      const result = sanitizeUrl(malicious);
      expect(result).toBe('');
    });

    it('handles empty input', () => {
      expect(sanitizeUrl('')).toBe('');
    });

    it('handles invalid URLs', () => {
      // URLs that look like safe relative paths are allowed
      const safeRelative = 'not-a-valid-url';
      expect(sanitizeUrl(safeRelative)).toBe(safeRelative);

      // URLs with unsafe characters are blocked
      expect(sanitizeUrl('<script>alert(1)</script>')).toBe('');
      expect(sanitizeUrl('contains javascript: here')).toBe('');
    });

    it('allows custom protocols when specified', () => {
      const url = 'tel:+1234567890';
      const result = sanitizeUrl(url, ['http:', 'https:', 'tel:']);
      expect(result).toBe(url);
    });
  });
});
