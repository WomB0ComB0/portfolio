'use client';

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
 * @public
 * @web
 * @author Mike Odnis
 * @see https://nextjs.org/docs/app/api-reference/functions/use-report-web-vitals
 * @description
 * WebVitals is a client-side component that reports Next.js Web Vitals metrics.
 * It uses `useReportWebVitals` to capture performance metrics such as TTFB, FCP, LCP, FID, CLS, and INP.
 * These metrics are logged to the console using a custom logger and also sent to Google Analytics (gtag)
 * for tracking and analysis.
 *
 * The component itself renders nothing (`return null;`) as its sole purpose is to
 * initialize the Web Vitals reporting mechanism.
 *
 * @returns {null} This component does not render any UI elements.
 */

import type { NextWebVitalsMetric } from 'next/app';
import { useReportWebVitals } from 'next/web-vitals';
import { memo } from 'react';
import { logger } from '@/utils';

export const WebVitals = memo(() => {
  /**
   * @private
   * @web
   * @description
   * Callback function for `useReportWebVitals` that processes each Web Vitals metric.
   * It logs the metric to the console and dispatches it as an event to Google Analytics (gtag).
   * For CLS (Cumulative Layout Shift), the value is multiplied by 1000 before sending to gtag
   * to align with common reporting practices (e.g., 0.1 CLS becomes 100).
   *
   * @param {NextWebVitalsMetric} metric - The Web Vitals metric object reported by Next.js.
   * @returns {void}
   */
  useReportWebVitals((metric: NextWebVitalsMetric) => {
    switch (metric.name) {
      case 'TTFB': {
        logger.info('TTFB:', { value: metric.value });
        break;
      }
      case 'FCP': {
        logger.info('FCP:', { value: metric.value });
        break;
      }
      case 'LCP': {
        logger.info('LCP:', { value: metric.value });
        break;
      }
      case 'FID': {
        logger.info('FID:', { value: metric.value });
        break;
      }
      case 'CLS': {
        logger.info('CLS:', { value: metric.value });
        break;
      }
      case 'INP': {
        logger.info('INP:', { value: metric.value });
        break;
      }
    }

    if (typeof globalThis.window.gtag === 'function') {
      globalThis.window.gtag('event', metric.name, {
        value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
        event_label: metric.id,
        non_interaction: true,
      });
    }
  });

  return null;
});
WebVitals.displayName = 'WebVitals';
export default WebVitals;
