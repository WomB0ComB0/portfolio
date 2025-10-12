'use client';

import React, { memo } from 'react';
import { ErrorLayout } from '.';

/**
 * The NotFound component renders a 404 error page with an animated background.
 *
 * @component
 * @description A memoized component that displays a 404 error page with a heading,
 * subheading, and a button to return to the home page. The page includes an animated
 * background and is fully responsive.
 *
 * @example
 * ```tsx
 * <NotFound />
 * ```
 */
export const NotFound = memo(() => {
  return <ErrorLayout title="404" description="Page Not Found" />;
});

NotFound.displayName = 'NotFound';
