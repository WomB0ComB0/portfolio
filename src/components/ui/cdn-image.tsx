/**
 * Copyright 2026 Mike Odnis
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
