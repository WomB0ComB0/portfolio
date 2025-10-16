/**
 * @public
 * @web
 * @component
 * @description Renders a 503 Service Unavailable error page.
 * This component displays a title and a descriptive message indicating that the service is temporarily unavailable.
 * It leverages the `ErrorLayout` component for consistent error page styling and structure.
 * @author Mike Odnis
 * @version 1.0.0
 * @see {@link ErrorLayout} for the underlying layout structure.
 */
'use client';

import React from 'react';
import { ErrorLayout } from '.';

const ServiceUnavailableError = React.memo(() => {
  return <ErrorLayout title="503" description="Service Unavailable - Please try again later" />;
});

ServiceUnavailableError.displayName = 'ServiceUnavailableError';
export { ServiceUnavailableError };
