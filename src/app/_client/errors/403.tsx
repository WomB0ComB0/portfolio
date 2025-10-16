'use client';

import React from 'react';
import { ErrorLayout } from '.';

/**
 * @author Mike Odnis
 * @version 1.0.0
 * @description A React functional component that renders a 403 Forbidden error page.
 * This component utilizes the generic `ErrorLayout` to display a standardized
 * error message for HTTP 403 status codes. It is memoized for performance optimization.
 * @see {@link ErrorLayout} for the underlying layout structure.
 * @returns {React.ReactElement} The rendered 403 Forbidden error page component.
 */
const ForbiddenError: React.FC = React.memo(() => {
  return <ErrorLayout title="403" description="Forbidden" />;
});

ForbiddenError.displayName = 'ForbiddenError';
export { ForbiddenError };
