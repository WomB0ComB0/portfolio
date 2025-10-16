
import * as React from 'react';

/**
 * @readonly
 * @const
 * @description
 * The breakpoint in pixels that defines the maximum width for mobile devices.
 * Used to determine when to trigger mobile UI adaptations.
 * @type {number}
 * @private
 * @author Mike Odnis
 * @version 1.0.0
 */
const MOBILE_BREAKPOINT = 768;

/**
 * Custom React Hook to detect if the current browser viewport matches a mobile device size.
 *
 * It sets up a listener on window resize events using the `matchMedia` API to update state whenever the viewport crosses the mobile breakpoint threshold.
 *
 * @function
 * @returns {boolean} Returns `true` if the window's width is less than the mobile breakpoint, otherwise `false`.
 * @throws {Error} Throws if called in a non-browser (server-side) environment where `window` is not defined.
 * @web
 * @public
 * @author Mike Odnis
 * @version 1.0.0
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Window/matchMedia
 * @example
 * const isMobile = useIsMobile();
 * if (isMobile) {
 *   // Render mobile navigation
 * } else {
 *   // Render desktop navigation
 * }
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      throw new Error('useIsMobile must be used in a browser environment.');
    }
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener('change', onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return !!isMobile;
}

