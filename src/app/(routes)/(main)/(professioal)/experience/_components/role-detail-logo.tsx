'use client';

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

import { type ReactElement, useState } from 'react';
import Image from '@/components/ui/cdn-image';

export interface RoleDetailLogoProps {
  readonly src: string | null;
  readonly monogram: string;
}

/**
 * A whole, full-color organization logo in the detail header's media slot. PageShell places it
 * beside the heading on desktop and above on mobile; the organization text supplies the name.
 * Missing or failed images keep the frame and show the same monogram as the role's list mark.
 */
export function RoleDetailLogo({ src, monogram }: RoleDetailLogoProps): ReactElement {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const hasImage = src !== null && src !== failedSrc;
  return (
    <span
      data-role-detail-logo=""
      aria-hidden="true"
      className="relative inline-flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-hairline bg-surface-1 @min-[40rem]/page:size-28"
    >
      {hasImage ? (
        <Image
          key={src}
          src={src}
          alt=""
          fill
          sizes="(min-width: 640px) 112px, 80px"
          className="object-contain p-2 @min-[40rem]/page:p-3"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <span className="text-2xl font-semibold text-foreground @min-[40rem]/page:text-3xl">
          {monogram || '?'}
        </span>
      )}
    </span>
  );
}
