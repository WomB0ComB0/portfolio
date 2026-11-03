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

import { describe, expect, it } from 'vitest';

import { getClientIP } from '@/lib/security/get-ip';

const request = (headers: Record<string, string>) =>
  new Request('https://mikeodnis.dev/api/health', { headers });

describe('getClientIP', () => {
  it('prefers X-Real-IP, which the hosting layer sets', () => {
    expect(
      getClientIP(
        request({
          'x-real-ip': '203.0.113.7',
          'x-vercel-forwarded-for': '198.51.100.1',
          'x-forwarded-for': '192.0.2.1, 10.0.0.1',
        }),
      ),
    ).toBe('203.0.113.7');
  });

  it('falls back to X-Vercel-Forwarded-For, then the first X-Forwarded-For entry', () => {
    expect(getClientIP(request({ 'x-vercel-forwarded-for': '198.51.100.1' }))).toBe('198.51.100.1');
    expect(getClientIP(request({ 'x-forwarded-for': '192.0.2.1, 10.0.0.1' }))).toBe('192.0.2.1');
  });

  it('ignores a client-supplied CF-Connecting-IP (the site is not behind Cloudflare)', () => {
    expect(
      getClientIP(request({ 'cf-connecting-ip': '127.0.0.1', 'x-real-ip': '203.0.113.7' })),
    ).toBe('203.0.113.7');
    expect(getClientIP(request({ 'cf-connecting-ip': '198.51.100.99' }))).toBe('127.0.0.1');
  });

  it('accepts Node-style header objects', () => {
    expect(getClientIP({ headers: { 'x-real-ip': '203.0.113.7' } } as never)).toBe('203.0.113.7');
  });
});
