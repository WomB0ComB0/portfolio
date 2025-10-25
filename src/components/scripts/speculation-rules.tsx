import type { PreloadConfig } from './speculation-rules.types';

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

('use client');

import { Stringify } from '@/utils';
import Script from 'next/script';
import { useCallback, useEffect, useRef } from 'react';

/**
 * Manages speculative preloading and prefetching using the Speculation Rules API.
 * It dynamically adds prefetch rules for in-viewport links.
 *
 * @returns {JSX.Element | null} The main speculation rules script tag or null if not supported.
 */
export function SpeculationRules({ nonce }: { nonce: string | undefined }) {
  const speculationScriptsRef = useRef<Set<string>>(new Set());

  const config: PreloadConfig = {
    prerenderPaths: ['/', '/projects', '/experience', '/'],
    prefetchPaths: ['/blog', '/guestbook', '/legal/*'],
  };

  const createSpeculationScript = useCallback(
    (rules: object, key?: string): HTMLScriptElement => {
      const script = document.createElement('script');
      script.type = 'speculationrules';
      if (key) script.dataset.speculation = key;
      if (nonce) script.nonce = nonce;
      script.textContent = Stringify(rules);
      return script;
    },
    [nonce],
  );

  const addDynamicSpeculation = useCallback(
    (link: string): void => {
      if (speculationScriptsRef.current.has(link)) return;

      const rules = { prefetch: [{ source: 'list', urls: [link] }] };
      const script = createSpeculationScript(rules, link);
      document.head.appendChild(script);
      speculationScriptsRef.current.add(link);
    },
    [createSpeculationScript],
  );

  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]): void => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const link = entry.target.getAttribute('href');
          if (link?.startsWith('/')) {
            addDynamicSpeculation(link);
          }
        }
      }
    },
    [addDynamicSpeculation],
  );

  useEffect(() => {
    const observer = new IntersectionObserver(handleIntersection, {
      threshold: 0.1,
      rootMargin: '50px',
    });

    const links = document.querySelectorAll('a[href^="/"]:not([data-no-prefetch])');
    for (const link of links) {
      observer.observe(link);
    }

    return () => {
      observer.disconnect();
      for (const link of speculationScriptsRef.current) {
        const script = document.querySelector(`script[data-speculation="${link}"]`);
        script?.remove();
      }
    };
  }, [handleIntersection]);

  if (typeof window === 'undefined' || !('speculationRules' in document)) {
    return null;
  }

  const baseSpeculationRules = {
    prerender: [{ source: 'list', urls: config.prerenderPaths, eagerness: 'moderate' }],
    prefetch: [{ source: 'list', urls: config.prefetchPaths }],
  };

  return (
    <Script
      id="speculation-rules"
      type="speculationrules"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: Stringify(baseSpeculationRules) }}
    />
  );
}
