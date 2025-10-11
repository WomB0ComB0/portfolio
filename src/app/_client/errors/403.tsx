'use client';

import React from 'react';
import { ErrorLayout } from '.';

const ForbiddenError: React.FC = React.memo(() => {
  return <ErrorLayout title="403" description="Forbidden" />;
});

ForbiddenError.displayName = 'ForbiddenError';
export { ForbiddenError };
