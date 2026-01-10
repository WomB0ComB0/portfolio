/**
 * Copyright 2025 Mike Odnis
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

import { cn } from '@/lib/utils';
import Link from 'next/link';

/**
 * Simple status link component with animated dot
 * Links to the Better Stack status page
 */
export const StatusLink = ({ className }: { className?: string }) => {
  return (
    <Link
      href="https://status.mikeodnis.dev"
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
        className,
      )}
      aria-label="Service status"
    >
      <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
      <span>Status</span>
    </Link>
  );
};
StatusLink.displayName = 'StatusLink';
export default StatusLink;
