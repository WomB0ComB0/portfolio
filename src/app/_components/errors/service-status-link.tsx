/**
 * Copyright 2026 Mike Odnis
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.
 */

import type { CSSProperties } from 'react';
import { STATUS_PAGE_URL } from '@/lib/status/service-state';

/** A recovery link that needs no router, provider, status request or application stylesheet. */
export function ServiceStatusLink({
  className,
  style,
}: {
  readonly className?: string;
  readonly style?: CSSProperties;
}) {
  return (
    <a
      href={STATUS_PAGE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Check service status (opens in a new tab)"
      className={className}
      style={style}
    >
      Check service status <span aria-hidden="true">↗</span>
    </a>
  );
}
