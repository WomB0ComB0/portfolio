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

'use client';

import Script from 'next/script';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { app } from '@/constants';
import { generateSchema, logger, Stringify } from '@/utils';

/**
 * A type representing the configuration for speculative preloading, prefetching, and exclusions,
 * primarily used for navigation performance optimizations.
 *
 * @typedef {Object} PreloadConfig
 * @property {readonly string[]} prerenderPaths Paths that should be eagerly prerendered.
 * @property {readonly string[]} prefetchPaths Paths to prefetch in the background.
 * @property {readonly string[]} excludePaths Paths to exclude from preloading or speculation rules.
 * @readonly
 * @author Mike Odnis
 * @see https://wicg.github.io/nav-speculation/speculation-rules.html
 * @public
 * @version 1.0.0
 */
type PreloadConfig = {
  prerenderPaths: string[];
  prefetchPaths: string[];
  excludePaths: string[];
};

/**
 * Scripts component responsible for:
 * - Preloading and prefetching routes intelligently via Speculation Rules API.
 * - Integrating tracking/analytics (Google Tag Manager, GA4).
 * - Injecting Google Maps API key (loaded securely from config).
 * - Exposing Schema.org Rich Results for the main Organization via JSON-LD.
 * - Handling view transitions with the View Transitions API.
 * - Preventing default context menu and managing script cleanup.
 *
 * @function Scripts
 * @constructor
 * @returns {JSX.Element} React component that injects scripts and sets up relevant preloading, tracking, and structured data.
 * @web
 * @public
 * @author Mike Odnis
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Speculation_Rules_API
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API
 * @see https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API
 * @see https://schema.org/Organization
 * @see https://github.com/WomB0ComB0/portfolio
 * @version 1.1.0
 * @example
 * // Use in layout/app for head/global scripts
 * <Scripts />
 */
export const Scripts = () => {
  /**
   * Holds the Google Maps API key (fetched from configuration at runtime).
   *
   * @type {[string, React.Dispatch<React.SetStateAction<string>>]}
   * @private
   */
  const [mapsApiKey, setMapsApiKey] = useState<string>('');

  /**
   * Loads Google Maps API key from configuration.
   *
   * @function
   * @returns {Promise<void>}
   * @async
   * @private
   * @throws {Error} If config cannot be loaded or accessed.
   */
  useEffect(() => {
    import('@/config').then((mod) => setMapsApiKey(mod.config.google.maps.apiKey || ''));
  }, []);

  /**
   * The configuration object controlling rules for speculation (preloading/prefetching/exclusion).
   *
   * @type {PreloadConfig}
   * @readonly
   * @private
   */
  const config = {
    prerenderPaths: ['/'],
    prefetchPaths: [
      '/blog',
      '/certifications',
      '/experience',
      '/guestbook',
      '/places',
      '/projects',
      '/resume',
      '/spotify',
      '/stats',
      '/sponsor',
    ],
    excludePaths: ['/api/*'],
  } as const satisfies PreloadConfig;

  /**
   * Reference to the IntersectionObserver used to observe visible links for speculation logic.
   *
   * @type {React.MutableRefObject<IntersectionObserver | null>}
   * @private
   */
  const observerRef = useRef<IntersectionObserver | null>(null);

  /**
   * Reference to a Set tracking links for which speculation scripts have been injected.
   *
   * @type {React.MutableRefObject<Set<string>>}
   * @private
   */
  const speculationScriptsRef = useRef<Set<string>>(new Set());

  /**
   * Prevents the default browser context menu from showing up (used for extra UX security/control).
   *
   * @function
   * @param {MouseEvent} event - The mouse contextmenu event to prevent.
   * @returns {void}
   * @private
   * @web
   * @author Mike Odnis
   * @version 1.0.0
   */
  const handleContextMenu = useCallback((event: MouseEvent): void => {
    event.preventDefault();
  }, []);

  /**
   * Initiates and manages page view transitions using the View Transitions API,
   * allowing for smooth animation between navigations (if supported by the browser).
   *
   * @function
   * @returns {void}
   * @private
   * @web
   * @author Mike Odnis
   * @see https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API
   * @version 1.0.0
   */
  const handleViewTransition = useCallback((): void => {
    if (!document.startViewTransition) return;

    document.startViewTransition(() => {
      flushSync(() => {
        document.body.classList.add('view-transition-group');
        document.body.classList.remove('view-transition-group');
      });
    });
  }, []);

  /**
   * Dynamically creates a script element with given speculation rules.
   *
   * @function
   * @param {object} rules - The speculation rules object (SpeculationRules Schema).
   * @returns {HTMLScriptElement} Created script element for the rules.
   * @private
   * @throws {Error} If the script cannot be created.
   * @web
   * @author Mike Odnis
   * @see https://wicg.github.io/nav-speculation/speculation-rules.html
   * @version 1.0.0
   * @example
   * const s = createSpeculationScript({ prefetch: [ ... ] });
   * document.head.appendChild(s);
   */
  const createSpeculationScript = useCallback((rules: object): HTMLScriptElement => {
    const script = document.createElement('script');
    script.type = 'speculationrules';
    script.text = Stringify(rules);
    return script;
  }, []);

  /**
   * Adds a dynamic speculation rules script for a given link.
   *
   * @function
   * @param {string} link - The internal URL path to prefetch.
   * @returns {void}
   * @private
   * @web
   * @throws {Error} If script cannot be appended.
   * @author WomB0ComB0
   * @see https://wicg.github.io/nav-speculation/speculation-rules.html
   * @version 1.0.0
   */
  const addDynamicSpeculation = useCallback(
    (link: string): void => {
      if (speculationScriptsRef.current.has(link)) return;

      const rules = {
        prefetch: [
          {
            source: 'list',
            urls: [link],
          },
        ],
      };

      const script = createSpeculationScript(rules);
      document.head.appendChild(script);
      speculationScriptsRef.current.add(link);
    },
    [createSpeculationScript],
  );

  /**
   * Handles entries for the Intersection Observer, initiating speculation/prefetch
   * for links becoming visible in the viewport.
   *
   * @function
   * @param {IntersectionObserverEntry[]} entries - Array of intersection entries.
   * @returns {void}
   * @private
   * @web
   * @version 1.0.0
   */
  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]): void => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const link = entry.target.getAttribute('href');
          if (link?.startsWith('/')) {
            addDynamicSpeculation(link);
          }
        }
      });
    },
    [addDynamicSpeculation],
  );

  /**
   * Side effect: Sets up speculation rules, intersection observation of links, event listeners,
   * and script cleanup logic on unmount.
   *
   * @function
   * @returns {void}
   * @async
   * @private
   * @web
   * @author WomB0ComB0
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API
   * @see https://wicg.github.io/nav-speculation/speculation-rules.html
   * @version 1.0.0
   */
  useEffect(() => {
    observerRef.current = new IntersectionObserver(handleIntersection, {
      threshold: 0.1,
      rootMargin: '50px',
    });

    const links = document.querySelectorAll('a[href^="/"]');
    links.forEach((link) => observerRef.current?.observe(link));

    document.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('navigate', handleViewTransition);

    return () => {
      observerRef.current?.disconnect();
      document.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('navigate', handleViewTransition);

      speculationScriptsRef.current.forEach((link) => {
        const script = document.querySelector(`script[data-speculation="${link}"]`);
        script?.remove();
      });
    };
  }, [handleContextMenu, handleIntersection, handleViewTransition]);

  /**
   * Base speculation rules configuration for prerendering and prefetching.
   * Structured for Speculation Rules API consumption. This includes:
   *   - List-based eager prerendering of specified paths.
   *   - Prefetch for pattern-matched/legal and resource-based paths.
   *   - Exclusion patterns for API routes.
   *
   * @see https://wicg.github.io/nav-speculation/speculation-rules.html
   * @readonly
   * @private
   */
  const baseSpeculationRules = {
    prerender: [
      {
        source: 'list',
        urls: config.prerenderPaths,
        eagerness: 'moderate',
      },
      {
        where: {
          and: [
            { href_matches: '/*' },
            ...config.excludePaths.map((path) => ({
              not: { href_matches: path },
            })),
          ],
        },
        eagerness: 'conservative',
      },
    ],
    prefetch: [
      {
        source: 'list',
        urls: config.prefetchPaths,
      },
      {
        where: {
          and: [
            { href_matches: '/resources/*' },
            { not: { selector_matches: '[data-no-prefetch]' } },
          ],
        },
        eagerness: 'conservative',
      },
    ],
  } as const;

  /**
   * Organization schema (JSON-LD, extended) generated for rich SEO.
   *
   * @readonly
   * @private
   * @see https://schema.org/Organization
   */
  const organizationSchema = generateSchema({
    type: 'Organization',
    name: app.name,
    url: app.url,
    thumbnailUrl: app.logo,
    logo: app.logo,
    sameAs: [
      'https://mikeodnis.dev',
      'https://news.mikeodnis.dev',
      'https://blog.mikeodnis.dev',
      'https://linkedin.com/in/mikeodnis',
      'https://instagram.com/mikeodnis.dev',
      'https://x.com/@mike_odnis',
      'https://bsky.app/profile/mikeodnis.dev',
    ],
  });

  return (
    <>
      {/* Google Analytics 4 (Gtag) */}
      <Script
        strategy="afterInteractive"
        src="https://www.googletagmanager.com/gtag/js?id=G-CS1B01WMJR"
      />
      <Script
        strategy="afterInteractive"
        id="google-analytics"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-CS1B01WMJR');
          `,
        }}
      />
      {/* Google Maps JS API (key is loaded dynamically and securely) */}
      <Script
        strategy="afterInteractive"
        src={`https://maps.googleapis.com/maps/api/js?key=${
          mapsApiKey
        }&callback=console.debug&libraries=maps,marker&v=beta&loading=async`}
      />
      {/* Google Tag Manager script */}
      <Script
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','GTM-NL4XDQ2B');
          `,
        }}
      />
      {/* Speculation Rules API for prerender/prefetch for navigation */}
      {typeof window
        ? 'SpeculationRules' in window && (
            <Script
              id="speculation-rules"
              strategy="beforeInteractive"
              type="speculationrules"
              dangerouslySetInnerHTML={{
                __html: Stringify(baseSpeculationRules),
              }}
              onError={(event) => {
                logger.error('Error loading speculation rules script:', event);
              }}
            />
          )
        : null}
      {/* Schema.org Organization */}
      <Script
        type="application/ld+json"
        id="schema-org"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: Stringify(organizationSchema),
        }}
        onError={(event) => {
          logger.error('Error loading Schema.org script:', event);
        }}
      />
      {/* Schema.org Extended/Custom Organization Schema */}
      <Script
        type="application/ld+json"
        id="schema-org-extended"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: Stringify(organizationSchema),
        }}
        onError={(event) => {
          logger.error('Error loading Schema.org extended script:', event);
        }}
      />
    </>
  );
};

/**
 * The display name for Scripts component, as used in React dev tools/UI.
 * @type {string}
 * @public
 * @readonly
 */
Scripts.displayName = 'Scripts';

export default Scripts;
