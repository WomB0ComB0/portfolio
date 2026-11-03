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

import { wakaTimeAuthorization } from '@/app/api/v1/[[...route]]/wakatime/auth';

describe('wakaTimeAuthorization', () => {
  it('sends a personal OAuth token as a Bearer token', () => {
    expect(wakaTimeAuthorization('waka_tok_example')).toBe('Bearer waka_tok_example');
  });

  it('tolerates surrounding whitespace and a pasted Bearer prefix', () => {
    expect(wakaTimeAuthorization('  waka_tok_example\n')).toBe('Bearer waka_tok_example');
    expect(wakaTimeAuthorization('Bearer waka_tok_example')).toBe('Bearer waka_tok_example');
  });

  it('rejects a legacy API key with setup guidance instead of calling WakaTime', () => {
    expect(() => wakaTimeAuthorization('waka_00000000-0000-0000-0000-000000000000')).toThrow(
      /not a WakaTime OAuth token.*wakatime\.com\/oauth/,
    );
  });

  it('never echoes the credential in the error message', () => {
    const secret = 'waka_00000000-1111-2222-3333-444444444444';
    expect(() => wakaTimeAuthorization(secret)).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining(secret) }),
    );
  });

  it('rejects a token with whitespace or other characters a Bearer token cannot hold', () => {
    for (const value of [
      'waka_tok_example\nBearer other',
      'waka_tok_ex ample',
      'waka_tok_ex"ample',
    ]) {
      expect(() => wakaTimeAuthorization(value)).toThrow(/characters a Bearer token can't contain/);
    }
  });

  it('accepts every character a Bearer token can hold', () => {
    expect(wakaTimeAuthorization('waka_tok_aZ09-._~+/==')).toBe('Bearer waka_tok_aZ09-._~+/==');
  });

  it('rejects a missing or blank credential', () => {
    expect(() => wakaTimeAuthorization(undefined)).toThrow(/is not set/);
    expect(() => wakaTimeAuthorization('   ')).toThrow(/is not set/);
  });
});
