'use client';

import React from 'react';
import { Loader } from '@/components/client/loader';

const Loading = React.memo(() => {
  return (
    <>
      <Loader />
    </>
  );
});

Loading.displayName = 'Loading';
export default Loading;
