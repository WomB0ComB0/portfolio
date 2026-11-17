import 'server-only';
import { env } from '@/env';
import { processGlobal } from '@/lib/cache/process-global';
import { reportApiFailure } from '@/lib/observability/report';
import { loadLinkCatalog } from './catalog';
import { probeLink } from './probe';
import { createLinkHealthService } from './service';
import { connectLinkHealthStore } from './store';
import type { LinkHealthScope } from './types';

const service = () =>
  processGlobal('link-health.v1', () => ({
    service: createLinkHealthService({
      store: connectLinkHealthStore(env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN),
      catalog: loadLinkCatalog,
      probe: probeLink,
      report: () =>
        reportApiFailure(new Error('Link health cache or refresh unavailable'), {
          context: 'link-health',
          level: 'warning',
        }),
    }),
  })).service;

export const readLinkHealth = (scope: LinkHealthScope) => service().read(scope);
export const refreshLinkHealth = (scope: LinkHealthScope) => service().refresh(scope);
