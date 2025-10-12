import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { z } from 'zod';
import { serviceAccount } from '@/core/firebase';

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

export type GAResponse = z.infer<typeof GAResponseSchema>;

export async function getAnalytics(): Promise<{
  analytics: { total_pageviews: number };
  response: GAResponse;
}> {
  if (process.env.NODE_ENV === 'development' || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
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

    return {
      analytics: {
        total_pageviews,
      },
      response: gaResponse,
    };
  } catch (error) {
    console.error('Error fetching GA data:', error);
    throw new Error(`${error instanceof Error ? error.message : 'Unknown error @ getAnalytics'}`);
  }
}

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
