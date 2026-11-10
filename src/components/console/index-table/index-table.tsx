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

/**
 * @file The IndexTable kit's markup: a year group (a section with its h2 and a real <table>
 * named by it, laid out from one <colgroup> so every year lines up), a row, the stretched title
 * link and the polite line the Copy ID action speaks through. Server-safe (no directive, no
 * hooks): pages render their rows on the server and a filter island only arranges them. Never
 * role="grid", never an onClick on a <tr>: the title is the row's one link.
 */

import Link from 'next/link';
import type { HTMLAttributes, ReactElement, ReactNode } from 'react';

import { NEW_TAB_LABEL, SrOnlyWords } from '@/components/console/tile-link';
import { cn } from '@/lib/utils';
import {
  INDEX_GROUP_CLASS,
  INDEX_ROW_CLASS,
  INDEX_TABLE_CLASS,
  INDEX_THEAD_CLASS,
  INDEX_TITLE_LINK_CLASS,
  INDEX_YEAR_CLASS,
  INDEX_YEAR_COUNT_CLASS,
  INDEX_YEAR_NUMBER_CLASS,
  type IndexColumn,
  type IndexVariant,
  indexColClass,
  indexHeaderClass,
} from './index-table-classes';

export interface IndexGroupProps {
  /** The h2's id, which names the table. */
  readonly id: string;
  /** The group's heading: a year, or "Undated". */
  readonly year: ReactNode;
  /** "26 certificates". */
  readonly count: string;
  readonly columns: readonly IndexColumn[];
  readonly variant?: IndexVariant;
  /** The rows (<tr>, usually server-rendered IndexRow). */
  readonly children: ReactNode;
}

/**
 * One year: the sticky year bar (the h2 "2024, 26 certificates", a pause between the numbers for
 * screen readers, then the column labels) over the year's rows.
 */
export function IndexGroup({
  id,
  year,
  count,
  columns,
  variant = 'ledger',
  children,
}: IndexGroupProps): ReactElement {
  return (
    <section data-index-part="group" className={INDEX_GROUP_CLASS}>
      <h2 id={id} data-index-part="year" className={INDEX_YEAR_CLASS}>
        <span className={INDEX_YEAR_NUMBER_CLASS}>{year}</span>
        <span className="sr-only">,</span> <span className={INDEX_YEAR_COUNT_CLASS}>{count}</span>
      </h2>
      <table aria-labelledby={id} data-variant={variant} className={INDEX_TABLE_CLASS}>
        <colgroup>
          {columns.map((column) => (
            <col key={column.id} className={indexColClass(column) || undefined} />
          ))}
        </colgroup>
        <thead className={INDEX_THEAD_CLASS}>
          <tr>
            {columns.map((column) => (
              <th key={column.id} scope="col" className={indexHeaderClass(column)}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </section>
  );
}

export interface IndexRowProps extends HTMLAttributes<HTMLTableRowElement> {
  /** Data attributes pass through: `data-cert-row`, a preview id. */
  readonly [data: `data-${string}`]: string | undefined;
}

/** One row: the tint hover, and the box its title link stretches over. */
export function IndexRow({ className, children, ...rest }: IndexRowProps): ReactElement {
  return (
    <tr data-index-row="" className={cn(INDEX_ROW_CLASS, className)} {...rest}>
      {children}
    </tr>
  );
}

interface IndexTitleLinkBase {
  readonly href: string;
  readonly className?: string;
  readonly children: ReactNode;
  readonly [data: `data-${string}`]: string | undefined;
}

/** Where the title goes: another site in a new tab, a page of this site, or a plain link. */
type IndexTitleLinkTarget =
  | {
      /** Opens in a new tab, said as the site says it: "(opens in a new tab)". */
      readonly external?: boolean;
      readonly internal?: never;
    }
  | {
      /**
       * A page of this site, through next/link (never prefetched): soft navigation keeps the
       * island and its URL state for Back, and a LinkPending inside shows while it loads.
       */
      readonly internal: true;
      readonly external?: never;
    };

export type IndexTitleLinkProps = IndexTitleLinkBase & IndexTitleLinkTarget;

/**
 * The row's one link, stretched over the whole row: next/link for an internal page, else a
 * plain <a> (a new tab when external). Both carry the same class and data attributes.
 */
export function IndexTitleLink({
  href,
  external = false,
  internal,
  className,
  children,
  ...data
}: IndexTitleLinkProps): ReactElement {
  const linkClass = cn(INDEX_TITLE_LINK_CLASS, className);
  if (internal) {
    return (
      <Link href={href} prefetch={false} data-index-link="" className={linkClass} {...data}>
        {children}
      </Link>
    );
  }
  return (
    <a
      href={href}
      data-index-link=""
      className={linkClass}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      {...data}
    >
      {children}
      {external && <SrOnlyWords>{NEW_TAB_LABEL}</SrOnlyWords>}
    </a>
  );
}

/** The polite line a Copy ID action speaks through: once per page, beside the tables. */
export function IndexAnnouncer(): ReactElement {
  return <p aria-live="polite" data-index-announcer="" className="sr-only" />;
}
