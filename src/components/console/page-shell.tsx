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

/**
 * @file The Live Console page frame: a left-aligned header (eyebrow, the page's one h1, a short
 * description, actions and a stat strip) above the page's content. Server-safe (no directive).
 *
 * It replaces the centred PageHeader as pages migrate. It renders no <main>: the shell's
 * PageMain is the landmark. Inside the shell, PageMain has no horizontal padding, so PageShell
 * applies the page gutter itself unless `gutter` is false.
 */

import type { ReactElement, ReactNode } from 'react';

import { cn } from '@/lib/utils';

const ROOT_CLASS = 'flex flex-col gap-8 md:gap-12';
const GUTTER_CLASS = 'px-(--page-gutter)';
const HEADER_CLASS =
  'grid gap-4 border-b border-hairline pb-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end';
const TITLE_CLASS = 'text-display font-extrabold tracking-display text-foreground';
const DESCRIPTION_CLASS = 'max-w-[60ch] text-body text-muted-foreground';

export interface PageShellProps {
  /** The page's one h1. */
  title: ReactNode;
  /** A short mono line above the title, e.g. 'Work · 22 projects'. */
  eyebrow?: ReactNode;
  description?: ReactNode;
  /** Usually a StatStrip; it spans the header's full width under the title. */
  stats?: ReactNode;
  /** Buttons or links beside the title on wide screens, under it on narrow ones. */
  actions?: ReactNode;
  /** Pads the sides with --page-gutter. Turn it off when a parent already pads. */
  gutter?: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * A page's header and content.
 *
 * @example
 * <PageShell eyebrow="Work" title="Projects" description="Things I built." stats={<StatStrip items={counts} />}>
 *   <TileGrid>...</TileGrid>
 * </PageShell>
 */
export function PageShell({
  title,
  eyebrow,
  description,
  stats,
  actions,
  gutter = true,
  className,
  children,
}: PageShellProps): ReactElement {
  return (
    <div className={cn(ROOT_CLASS, gutter && GUTTER_CLASS, className)}>
      <header className={HEADER_CLASS}>
        <div className="min-w-0 space-y-3">
          {eyebrow && <p className="label-mono text-muted-foreground">{eyebrow}</p>}
          <h1 className={TITLE_CLASS}>{title}</h1>
          {description && <p className={DESCRIPTION_CLASS}>{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        {stats && <div className="md:col-span-2">{stats}</div>}
      </header>
      {children}
    </div>
  );
}
