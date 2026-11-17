'use client';

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

import { useSyncExternalStore } from 'react';
import type { LinkHealthScope } from '@/lib/link-health/types';
import { normalizeLinkUrl } from '@/lib/link-health/url';
import {
  createLinkHealthStore,
  EMPTY_LINK_HEALTH,
  freshWarning,
  type LinkHealthStore,
} from './link-health-store';

const stores = new Map<LinkHealthScope, LinkHealthStore>();
const serverSnapshot = () => EMPTY_LINK_HEALTH;
const noSubscription = () => () => undefined;
const storeFor = (scope: LinkHealthScope): LinkHealthStore => {
  let store = stores.get(scope);
  if (!store) {
    store = createLinkHealthStore(scope);
    stores.set(scope, store);
  }
  return store;
};

/** Called after unmount in isolated client tests; an active subscription owns its own cleanup. */
export function resetLinkHealthClientCache(): void {
  stores.clear();
}

export function useLinkHealth(href: string | null | undefined, scope: LinkHealthScope) {
  const url = normalizeLinkUrl(href);
  const store = url ? storeFor(scope) : null;
  const snapshot = useSyncExternalStore(
    store?.subscribe ?? noSubscription,
    store?.getSnapshot ?? serverSnapshot,
    serverSnapshot,
  );
  const entry = url && Object.hasOwn(snapshot.links, url) ? snapshot.links[url] : undefined;
  return { url, entry: freshWarning(entry, Date.now(), url ?? undefined) };
}
