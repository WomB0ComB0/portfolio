'use client';

import React from 'react';
import { ErrorLayout } from '.';

const UnauthorizedError: React.FC = React.memo(() => {
  return <ErrorLayout title="401" description="Unauthorized" />;
});

UnauthorizedError.displayName = 'UnauthorizedError';
export { UnauthorizedError };
