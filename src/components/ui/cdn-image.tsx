'use client';

import NextImage from 'next/image';
import type { ComponentProps, ReactElement } from 'react';
import { canResizeAtCdn, cdnImageLoader } from '@/lib/images/cdn-loader';

/** Keep Next's layout/lazy-loading behavior, with images delivered by their original CDN. */
export default function CdnImage({
  loader,
  unoptimized,
  ...props
}: ComponentProps<typeof NextImage>): ReactElement {
  const nativeResize = typeof props.src === 'string' && canResizeAtCdn(props.src);
  return (
    <NextImage
      {...props}
      loader={loader ?? (nativeResize ? cdnImageLoader : undefined)}
      unoptimized={unoptimized || (!nativeResize && !loader)}
    />
  );
}
