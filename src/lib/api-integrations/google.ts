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

import { serviceAccount } from '@/core/firebase';
import { logger } from '@/utils';
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { z } from 'zod';

/**
 * @readonly
 * @description Zod schema describing the expected structure of a Google Analytics API response.
 * @see https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/reports/run
 * @author Mike Odnis
 * @version 1.0.0
 */
const GAResponseSchema = z.object({
  dimensionHeaders: z.array(
    z.object({
      name: z.string(),
    }),
  ),
  metricHeaders: z.array(
    z.object({
      name: z.string(),
      type: z.string(),
    }),
  ),
  rows: z.array(
    z.object({
      dimensionValues: z.array(
        z.object({
          value: z.string(),
          oneValue: z.literal('value'),
        }),
      ),
      metricValues: z.array(
        z.object({
          value: z.string(),
          oneValue: z.literal('value'),
        }),
      ),
    }),
  ),
  totals: z.array(z.unknown()),
  maximums: z.array(z.unknown()),
  minimums: z.array(z.unknown()),
  rowCount: z.number(),
  metadata: z.object({
    samplingMetadatas: z.array(z.unknown()),
    dataLossFromOtherRow: z.boolean(),
    currencyCode: z.string(),
    _currencyCode: z.literal('currencyCode'),
    timeZone: z.string(),
    _timeZone: z.literal('timeZone'),
  }),
  propertyQuota: z.null(),
  kind: z.literal('analyticsData#runReport'),
});

/**
 * Type representing the shape of a Google Analytics API response.
 * @see GAResponseSchema
 * @author Mike Odnis
 * @version 1.0.0
 */
export type GAResponse = z.infer<typeof GAResponseSchema>;

/**
 * Fetches Google Analytics pageview data for the last 30 days using a service account.
 * Returns both the total pageviews and the raw GA API response for further use.
 *
 * - Will return mock/empty analytics if the `DISABLE_ANALYTICS` environment variable is set.
 * - Designed for server-side execution in the portfolio project.
 *
 * @async
 * @function
 * @public
 * @returns {Promise<{ analytics: { total_pageviews: number }, response: GAResponse }>}
 * An object containing the total pageviews and the corresponding GA response.
 * @throws {Error} Throws if credentials are missing or an API error occurs.
 * @web
 * @author Mike Odnis
 * @version 1.0.0
 * @see https://developers.google.com/analytics/devguides/reporting/data/v1/
 * @example
 * const { analytics, response } = await getAnalytics();
 * console.log("Total pageviews:", analytics.total_pageviews);
 */
export async function getAnalytics(): Promise<{
  analytics: { total_pageviews: number };
  response: GAResponse;
}> {
  // Skip Firebase emulator check - only skip if explicitly disabled via env var
  if (process.env.DISABLE_ANALYTICS === 'true') {
    logger.info('[Analytics] Analytics disabled via DISABLE_ANALYTICS env var');
    return {
      analytics: { total_pageviews: 0 },
      response: {
        dimensionHeaders: [],
        metricHeaders: [],
        rows: [],
        rowCount: 0,
        kind: 'analyticsData#runReport',
        totals: [],
        maximums: [],
        minimums: [],
        metadata: {
          samplingMetadatas: [],
          dataLossFromOtherRow: false,
          currencyCode: '',
          _currencyCode: 'currencyCode',
          timeZone: '',
          _timeZone: 'timeZone',
        },
        propertyQuota: null,
      } satisfies GAResponse,
    };
  }

  logger.info('[Analytics] Fetching Google Analytics data...');

  const formattedPrivateKey = serviceAccount.private_key.replace(/\\n/g, '\n');

  const client = new BetaAnalyticsDataClient({
    credentials: {
      client_email: serviceAccount.client_email,
      private_key: formattedPrivateKey,
    },
  });

  const request = {
    property: 'properties/431094773',
    dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
    dimensions: [{ name: 'date' }, { name: 'deviceCategory' }],
    metrics: [{ name: 'screenPageViews' }],
  };
  try {
    const response = await client.runReport(request);
    const gaResponse = response[0] as GAResponse;
    const total_pageviews =
      gaResponse.rows?.reduce(
        (sum: number, row: { metricValues: { value: string }[] }) =>
          sum + Number.parseInt(row.metricValues[0]?.value || '0', 10),
        0,
      ) || 0;

    logger.info(
      `[Analytics] Successfully fetched ${total_pageviews} pageviews from ${gaResponse.rows?.length || 0} rows`,
    );

    return {
      analytics: {
        total_pageviews,
      },
      response: gaResponse,
    };
  } catch (error) {
    logger.error('[Analytics] Error fetching GA data:', error);
    logger.error('[Analytics] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      credentials: {
        hasClientEmail: !!serviceAccount.client_email,
        hasPrivateKey: !!serviceAccount.private_key,
        privateKeyLength: serviceAccount.private_key?.length || 0,
      },
    });
    throw new Error(`${error instanceof Error ? error.message : 'Unknown error @ getAnalytics'}`);
  }
}

/**
 * Formats raw Google Analytics data into an array of daily aggregates by device category.
 *
 * Each element in the output array represents a date with pageview totals for "desktop" and "mobile" devices.
 * The input must follow the shape of a valid {@link GAResponse}.
 *
 * @function
 * @public
 * @param {GAResponse} response - The raw GA API response data.
 * @returns {Array<{ date: string, desktop: number, mobile: number }>} Array of formatted daily device totals.
 * @example
 * const formatted = formatGAData(response);
 * console.log(formatted[0]); // { date: '20240510', desktop: 123, mobile: 456 }
 * @throws {TypeError} If device category values differ from expected keys.
 * @web
 * @author Mike Odnis
 * @version 1.0.0
 * @see getAnalytics
 */
export const formatGAData = (response: GAResponse) => {
  const formattedData: { [key: string]: any } = {};

  response.rows?.forEach((row: any) => {
    const date = row.dimensionValues[0].value;
    const device = row.dimensionValues[1].value.toLowerCase();
    const views = Number.parseInt(row.metricValues[0].value, 10);

    if (!formattedData[date]) {
      formattedData[date] = { date, desktop: 0, mobile: 0 };
    }

    formattedData[date][device] += views;
  });

  return Object.values(formattedData);
};
