// @vitest-environment node
/**
 * Copyright 2026 Mike Odnis
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

import { generateKeyPairSync, verify } from 'node:crypto';
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { JWT } from 'google-auth-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const credentials = vi.hoisted(() => ({ getServiceAccount: vi.fn() }));
const logger = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn() }));
vi.mock('@/core/firebase-admin', () => credentials);
vi.mock('@/utils', () => ({ logger }));

import { type GAResponse, getAnalytics } from '@/lib/api-integrations/google';

// Generated for this process only. No real service-account credential or Google request is used.
const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const privateKey = keys.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
const email = 'analytics-test@example.iam.gserviceaccount.com';
const projectId = 'analytics-test-project';
const READONLY_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
const report: GAResponse = {
  dimensionHeaders: [],
  metricHeaders: [],
  rows: [
    { dimensionValues: [], metricValues: [{ value: '17', oneValue: 'value' }] },
    { dimensionValues: [], metricValues: [{ value: '13', oneValue: 'value' }] },
  ],
  totals: [],
  maximums: [],
  minimums: [],
  rowCount: 2,
  metadata: {
    samplingMetadatas: [],
    dataLossFromOtherRow: false,
    currencyCode: 'USD',
    _currencyCode: 'currencyCode',
    timeZone: 'America/New_York',
    _timeZone: 'timeZone',
  },
  propertyQuota: null,
  kind: 'analyticsData#runReport',
};

let client: BetaAnalyticsDataClient | undefined;

function analyticsClient(): BetaAnalyticsDataClient {
  if (!client) throw new Error('The Analytics client was not constructed');
  return client;
}

beforeEach(() => {
  vi.stubEnv('DISABLE_ANALYTICS', 'false');
  credentials.getServiceAccount.mockReset().mockReturnValue({
    type: 'service_account',
    project_id: projectId,
    client_email: email,
    private_key: privateKey.replaceAll('\n', '\\n'),
  });
  logger.info.mockClear();
  logger.error.mockClear();
  client = undefined;
  // Keep the real SDK constructor/auth path; replace only the remote report RPC.
  vi.spyOn(BetaAnalyticsDataClient.prototype, 'runReport').mockImplementation(function (
    this: BetaAnalyticsDataClient,
  ) {
    client = this;
    return Promise.resolve([report]);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('Google Analytics authentication', () => {
  it('constructs the real SDK with an explicit service-account signer and no credentials warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await getAnalytics();
    expect(warn).not.toHaveBeenCalled();
    expect(client).toBeDefined();
    const auth = analyticsClient().auth;
    expect(auth.jsonContent).toBeNull();
    const signer = await auth.getClient();
    expect(signer).toBeInstanceOf(JWT);
    if (!(signer instanceof JWT)) throw new Error('Expected service-account JWT authentication');
    expect(signer.email).toBe(email);
    expect(signer.key).toBe(privateKey);
    expect(await auth.getProjectId()).toBe(projectId);
  });

  it('signs the Analytics read-only scope locally with the normalized key, without token exchange', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await getAnalytics();
    const auth = analyticsClient().auth;
    const signer = await auth.getClient();
    if (!(signer instanceof JWT)) throw new Error('Expected service-account JWT authentication');
    const network = vi
      .spyOn(signer.transporter, 'request')
      .mockRejectedValue(new Error('No network'));
    const headers = await auth.getRequestHeaders('https://analyticsdata.googleapis.com');
    const token = headers.get('authorization')?.replace(/^Bearer /, '');
    expect(token).toBeDefined();
    if (!token) throw new Error('No authorization header');
    const [encodedHeader, payload, signature] = token.split('.');
    if (!encodedHeader || !payload || !signature) throw new Error('Expected a signed JWT');
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
    expect(claims.iss).toBe(email);
    expect(claims.scope).toBe(READONLY_SCOPE);
    expect(
      verify(
        'RSA-SHA256',
        Buffer.from(`${encodedHeader}.${payload}`),
        keys.publicKey,
        Buffer.from(signature, 'base64url'),
      ),
    ).toBe(true);
    expect(network).not.toHaveBeenCalled();
    expect(signer.useJWTAccessWithScope).toBe(true);
  });

  it('keeps the report property, dimensions, date range and total pageviews unchanged', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const result = await getAnalytics();
    expect(BetaAnalyticsDataClient.prototype.runReport).toHaveBeenCalledWith({
      property: 'properties/431094773',
      dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'date' }, { name: 'deviceCategory' }],
      metrics: [{ name: 'screenPageViews' }],
    });
    expect(result).toEqual({ analytics: { total_pageviews: 30 }, response: report });
  });

  it('does not read credentials or create the SDK client when analytics are disabled', async () => {
    vi.stubEnv('DISABLE_ANALYTICS', 'true');
    const result = await getAnalytics();
    expect(credentials.getServiceAccount).not.toHaveBeenCalled();
    expect(BetaAnalyticsDataClient.prototype.runReport).not.toHaveBeenCalled();
    expect(result.analytics.total_pageviews).toBe(0);
    expect(result.response.rows).toEqual([]);
  });

  it('preserves the existing report failure behavior without logging signing material', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.mocked(BetaAnalyticsDataClient.prototype.runReport).mockRejectedValue(
      new Error('Report unavailable'),
    );
    await expect(getAnalytics()).rejects.toThrow('Report unavailable');
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain(privateKey);
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain(
      privateKey.replaceAll('\n', '\\n'),
    );
  });
});
