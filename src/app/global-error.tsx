'use client';

import NextError from 'next/error';
import { useEffect } from 'react';
import { onRequestError } from '@/core';

export const GlobalError = ({ error }: { error: Error & { digest?: string } }) => {
  useEffect(() => {
    onRequestError(error);
  }, [error]);

  return (
    <html>
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
};
GlobalError.displayName = 'GlobalError';
export default GlobalError;
