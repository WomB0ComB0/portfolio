'use client';

import React, { memo } from 'react';
import { ErrorLayout } from '.';

/**
 * Renders a 404 "Page Not Found" error page.
 *
 * This is a memoized client component that utilizes the `ErrorLayout`
 * to display a consistent error message format with an animated background.
 * It's typically handled by the Next.js App Router for unmatched routes.
 *
 * @component
 * @public
 * @author Mike Odnis
 * @version 1.0.0
 * @see {@link ErrorLayout} for the underlying layout structure.
 * @returns {React.ReactElement} The rendered 404 error page component.
 * @example
 * ```tsx
 * // This component is typically used by Next.js routing for handling 404 errors.
 * // No direct usage is usually required.
 * <NotFound />
 * ```
 */
export const NotFound = memo(() => {
  return <ErrorLayout title="404" description="Page Not Found" />;
});

NotFound.displayName = 'NotFound';
