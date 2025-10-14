import { describe, expect, it } from 'vitest';
import {
  escapeHtml,
  sanitizeHtml,
  sanitizeJson,
  sanitizeMarkdown,
  sanitizeUrl,
  validateUserInput,
} from './xss';

describe('sanitizeHtml', () => {
  it('should remove script tags', () => {
    const html = '<script>alert("xss")</script><p>hello</p>';
    expect(sanitizeHtml(html)).toBe('<p>hello</p>');
  });

  it('should handle empty and invalid input', () => {
    expect(sanitizeHtml('')).toBe('');
    expect(sanitizeHtml(null as any)).toBe('');
    expect(sanitizeHtml(undefined as any)).toBe('');
  });
});

describe('sanitizeMarkdown', () => {
  it('should convert markdown to sanitized html', async () => {
    const markdown = '**hello** <script>alert("xss")</script>';
    const expected = '<strong>hello</strong>';
    const result = await sanitizeMarkdown(markdown);
    expect(result).toContain(expected);
    expect(result).not.toContain('<script>');
  });
});

describe('sanitizeUrl', () => {
  it('should allow valid http and https urls', () => {
    const url = 'https://example.com';
    expect(sanitizeUrl(url)).toBe(url);
  });

  it('should block javascript urls', () => {
    const url = 'javascript:alert("xss")';
    expect(sanitizeUrl(url)).toBe('');
  });
});

describe('validateUserInput', () => {
  it('should trim and remove html tags', () => {
    const input = '  <p>hello</p>  ';
    expect(validateUserInput(input)).toBe('hello');
  });

  it('should not remove html tags when allowHtml is true', () => {
    const input = '  <p>hello</p>  ';
    expect(validateUserInput(input, 500, true)).toBe('<p>hello</p>');
  });
});

describe('escapeHtml', () => {
  it('should escape html special characters', () => {
    const text = '<script>"\'&';
    expect(escapeHtml(text)).toBe('&lt;script&gt;&quot;&#039;&amp;');
  });
});

describe('sanitizeJson', () => {
  it('should parse valid json', () => {
    const json = '{"key": "value"}';
    expect(sanitizeJson(json)).toEqual({ key: 'value' });
  });

  it('should return null for invalid json', () => {
    const json = '{"key": "value"';
    expect(sanitizeJson(json)).toBeNull();
  });
});
