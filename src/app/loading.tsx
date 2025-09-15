'use client';

import { Loader } from '@/components/client/loader';
import React from 'react';

const Loading = React.memo(() => {
  return (
    <>
      <Loader />
    </>
  );
});

Loading.displayName = 'Loading';
export default Loading;
