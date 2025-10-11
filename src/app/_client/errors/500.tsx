'use client';

import React from 'react';
import { ErrorLayout } from '.';

const InternalServerError = React.memo(
  ({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) => {
    return (
      <ErrorLayout title="500" description="Internal Server Error" error={error} reset={reset} />
    );
  },
);

InternalServerError.displayName = 'InternalServerError';
export { InternalServerError };
