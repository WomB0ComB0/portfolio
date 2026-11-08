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
 * @file validateUserInput lives in its own module, so a client island that only checks typed text
 * (the guestbook's compose box) does not ship DOMPurify and marked, which only sanitizeHtml and
 * sanitizeMarkdown need. xss.ts still exports the same function, so its callers are unchanged.
 */

import { describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ purifyLoaded: false, markedLoaded: false }));

vi.mock('dompurify', () => {
  h.purifyLoaded = true;
  return { default: { sanitize: (html: string) => html } };
});
vi.mock('marked', () => {
  h.markedLoaded = true;
  return { marked: { parse: async (markdown: string) => markdown } };
});

describe('the user-input module', () => {
  it('validates text without loading DOMPurify or marked', async () => {
    const { validateUserInput } = await import('@/utils/security/user-input');

    expect(validateUserInput("  It's <b>bold</b> &  fun ", 280)).toBe("It's bold & fun");
    expect(h.purifyLoaded).toBe(false);
    expect(h.markedLoaded).toBe(false);
  });

  it('is the function xss.ts exports, so existing callers are unchanged', async () => {
    const { validateUserInput } = await import('@/utils/security/user-input');
    const xss = await import('@/utils/security/xss');

    expect(xss.validateUserInput).toBe(validateUserInput);
  });
});
