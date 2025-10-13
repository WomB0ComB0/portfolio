'use client';

import type { NextWebVitalsMetric } from 'next/app';
import { useReportWebVitals } from 'next/web-vitals';
import { memo } from 'react';
import { logger } from '@/utils';

export const WebVitals = memo(() => {
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
