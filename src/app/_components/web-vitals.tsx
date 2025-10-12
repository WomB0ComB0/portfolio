'use client';

import { Logger } from '@/utils';
import type { NextWebVitalsMetric } from 'next/app';
import { useReportWebVitals } from 'next/web-vitals';
import { memo } from 'react';

export const WebVitals = memo(() => {
  const log = Logger.getLogger('WebVitals');
  useReportWebVitals((metric: NextWebVitalsMetric) => {
    switch (metric.name) {
      case 'TTFB': {
        log.info('TTFB:', metric.value);
        break;
      }
      case 'FCP': {
        log.info('FCP:', metric.value);
        break;
      }
      case 'LCP': {
        log.info('LCP:', metric.value);
        break;
      }
      case 'FID': {
        log.info('FID:', metric.value);
        break;
      }
      case 'CLS': {
        log.info('CLS:', metric.value);
        break;
      }
      case 'INP': {
        log.info('INP:', metric.value);
        break;
      }
    }

    if (typeof window.gtag === 'function') {
      window.gtag('event', metric.name, {
        value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
        event_label: metric.id,
        non_interaction: true,
      });
    }
  });

  return null;
});
export default WebVitals;
