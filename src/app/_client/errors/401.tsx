'use client';

import React from 'react';
import { ErrorLayout } from '.';

/**
 * @author Mike Odnis
 * @version 1.0.0
 * @description A client component that renders a 401 Unauthorized error page.
 * This component utilizes the shared `ErrorLayout` to display a standardized
 * error message for unauthorized access attempts.
 * @see {@link ErrorLayout} for the underlying layout structure.
 * @returns {React.ReactElement} The rendered 401 error page component.
 */
const UnauthorizedError: React.FC = React.memo(() => {
  return <ErrorLayout title="401" description="Unauthorized" />;
});

UnauthorizedError.displayName = 'UnauthorizedError';
export { UnauthorizedError };
