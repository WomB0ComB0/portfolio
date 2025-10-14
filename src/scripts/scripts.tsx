'use client';

import Script from 'next/script';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { app } from '@/constants';
import { generateSchema, Stringify } from '@/utils';

/**
 * Configuration type for preload/prefetch behavior
 * @typedef {Object} PreloadConfig
 * @property {string[]} prerenderPaths - Paths to prerender eagerly for instant navigation
 * @property {string[]} prefetchPaths - Paths to prefetch in the background
 * @property {string[]} excludePaths - Paths to exclude from preloading
 */
type PreloadConfig = {
  prerenderPaths: string[];
  prefetchPaths: string[];
  excludePaths: string[];
};

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Speculation_Rules_API
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API
 * @see https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API
 * @see https://schema.org/
 */

export const Scripts = () => {
  const [mapsApiKey, setMapsApiKey] = useState<string>('');

  useEffect(() => {
    import('@/config').then((mod) => setMapsApiKey(mod.config.google.maps.apiKey));
  }, []);
  const schemaOrg = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: app.name,
    url: app.url,
    image: app.logo,
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
  } as const;
  /**
   * Configuration object defining paths for preloading behavior
   */
  const config: PreloadConfig = {
    prerenderPaths: ['/'],
    prefetchPaths: ['/legal/*'],
    excludePaths: ['/api/*'],
  };

  /**
   * Ref to store the intersection observer instance
   */
  const observerRef = useRef<IntersectionObserver | null>(null);

  /**
   * Ref to track which links have already had speculation rules added
   */
  const speculationScriptsRef = useRef<Set<string>>(new Set());

  /**
   * Prevents default context menu behavior
   * @param {MouseEvent} event - The context menu event
   */
  const handleContextMenu = useCallback((event: MouseEvent) => {
    event.preventDefault();
  }, []);

  /**
   * Handles view transitions between pages using the View Transitions API
   * Adds and removes transition classes for animation
   */
  const handleViewTransition = useCallback(() => {
    if (!document.startViewTransition) return;

    document.startViewTransition(() => {
      flushSync(() => {
        document.body.classList.add('view-transition-group');
        document.body.classList.remove('view-transition-group');
      });
    });
  }, []);

  /**
   * Creates a speculation rules script element
   * @param {object} rules - The speculation rules to apply
   * @returns {HTMLScriptElement} The created script element
   */
  const createSpeculationScript = useCallback((rules: object) => {
    const script = document.createElement('script');
    script.type = 'speculationrules';
    script.text = Stringify(rules);
    return script;
  }, []);

  /**
   * Adds dynamic speculation rules for a specific link
   * @param {string} link - The URL to add speculation rules for
   */
  const addDynamicSpeculation = useCallback(
    (link: string) => {
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
   * Handles intersection observer entries
   * Adds speculation rules for links as they become visible
   * @param {IntersectionObserverEntry[]} entries - The intersection entries to process
   */
  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
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
   * Sets up intersection observer, event listeners, and cleanup
   * - Initializes intersection observer for link prefetching
   * - Adds event listeners for context menu and navigation
   * - Cleans up observers and listeners on unmount
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

  // TODO: 🚩
  /**
   * Base speculation rules configuration for prerendering and prefetching
   * Defines rules for:
   * - Prerendering specific paths with different eagerness levels
   * - Prefetching paths and patterns with conditions
   * - Excluding certain paths from speculation
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
  } as const);
  return (
    <>
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
      <Script
        strategy="afterInteractive"
        src={`https://maps.googleapis.com/maps/api/js?key=${mapsApiKey
          }&callback=console.debug&libraries=maps,marker&v=beta&loading=async`}
      />
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
      <Script
        id="speculation-rules"
        strategy="beforeInteractive"
        type="speculationrules"
        dangerouslySetInnerHTML={{
          __html: Stringify(baseSpeculationRules),
        }}
        onError={(event) => {
          console.error('Error loading speculation rules script:', event);
        }}
      />

      <Script
        type="application/ld+json"
        id="schema-org"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: Stringify(schemaOrg),
        }}
        onError={(event) => {
          console.error('Error loading Schema.org script:', event);
        }}
      />

      <Script
        type="application/ld+json"
        id="schema-org-extended"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: Stringify(organizationSchema),
        }}
        onError={(event) => {
          console.error('Error loading Schema.org extended script:', event);
        }}
      />
    </>
  );
};
Scripts.displayName = 'Scripts';
export default Scripts;
