'use client';

import React from 'react';
import { ErrorLayout } from '.';

const ServiceUnavailableError = React.memo(() => {
  return <ErrorLayout title="503" description="Service Unavailable - Please try again later" />;
});

ServiceUnavailableError.displayName = 'ServiceUnavailableError';
export { ServiceUnavailableError };
