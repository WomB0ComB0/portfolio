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

const OAUTH_TOKEN_PREFIX = 'waka_tok_';

/** RFC 6750 `b64token`: the only characters a Bearer token can hold (no whitespace or line breaks). */
const BEARER_TOKEN_PATTERN = /^[A-Za-z0-9\-._~+/]+=*$/;

const TOKEN_HELP =
  'Create a personal OAuth token with the read_stats scope at https://wakatime.com/oauth and set it as WAKA_TIME_API_KEY.';

/**
 * Builds the Authorization header for WakaTime read endpoints.
 *
 * WakaTime API keys are write-only (accepted only on plugin endpoints); read endpoints such as
 * `all_time_since_today` answer 403 for them and need a personal OAuth token (`waka_tok_…`)
 * sent as a Bearer token. Fails fast with setup guidance instead of a bare upstream 403.
 *
 * @param {string | undefined} credential - Value of WAKA_TIME_API_KEY.
 * @returns {string} The `Authorization` header value.
 * @throws {Error} When the credential is missing, is a legacy API key, or has characters a Bearer
 *   token can't contain.
 */
export function wakaTimeAuthorization(credential: string | undefined): string {
  const token = (credential ?? '').trim().replace(/^Bearer\s+/i, '');
  if (!token) {
    throw new Error(`WAKA_TIME_API_KEY is not set. ${TOKEN_HELP}`);
  }
  if (!token.startsWith(OAUTH_TOKEN_PREFIX)) {
    throw new Error(
      `WAKA_TIME_API_KEY is not a WakaTime OAuth token; API keys only work for editor plugins. ${TOKEN_HELP}`,
    );
  }
  if (!BEARER_TOKEN_PATTERN.test(token)) {
    throw new Error(
      `WAKA_TIME_API_KEY has characters a Bearer token can't contain (such as spaces or line breaks). Copy the token again. ${TOKEN_HELP}`,
    );
  }
  return `Bearer ${token}`;
}
