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
 * @file One certificate's row in the Ledger, rendered on the server and handed to the filter
 * island as markup. Server-safe (no directive, no hooks).
 *
 * On a wide page the row is four cells: the title (linked when there is a credential URL) with
 * its split skills faint underneath, the issuer as written on the credential, the month, and
 * Verify (the destination host, then the credential ID as a mono token). On a phone the other
 * cells are hidden and the title cell carries one meta line instead: "Issuer · Mon YYYY · host".
 */

import type { ReactElement } from 'react';

import { NEW_TAB_LABEL, NewTabArrow, SrOnlyWords } from '@/components/console';
import { cn } from '@/lib/utils';
import type { LedgerEntry } from '../_lib/ledger';
import {
  DESKTOP_CELL_CLASS,
  HOST_LINK_CLASS,
  HOST_TEXT_CLASS,
  ID_CLASS,
  ROW_CLASS,
  TITLE_CELL_CLASS,
  VERIFY_CLASS,
} from './ledger-classes';

const TITLE_TEXT_CLASS = 'tile-sub font-medium text-foreground';
/** The arrow stays faint; the title turns brand on hover. */
const TITLE_LINK_CLASS = `${TITLE_TEXT_CLASS} underline-offset-4 hover:text-brand-ink hover:underline [&_[data-new-tab-arrow]]:text-faint`;
const SKILLS_CLASS =
  'hidden truncate tile-meta leading-4 text-faint @min-[40rem]/page:mt-0.5 @min-[40rem]/page:block';
const PHONE_META_CLASS = 'mt-0.5 tile-meta text-muted-foreground @min-[40rem]/page:hidden';

interface RowProps {
  readonly entry: LedgerEntry;
}

/** The title: a new-tab link to the credential, worded as the site words new-tab links. */
function CertificateTitle({ entry }: RowProps): ReactElement {
  if (!entry.link) {
    return (
      <span data-cert-title="" className={TITLE_TEXT_CLASS}>
        {entry.title}
      </span>
    );
  }
  return (
    <a
      data-cert-title=""
      href={entry.link.href}
      target="_blank"
      rel="noopener noreferrer"
      className={TITLE_LINK_CLASS}
    >
      {entry.title}
      <NewTabArrow />
      <SrOnlyWords>{NEW_TAB_LABEL}</SrOnlyWords>
    </a>
  );
}

/**
 * The host links where the title does, for a pointer aimed at the column. The title is the one
 * keyboard and screen reader stop, so this copy is out of the tab order and hidden from readers,
 * who get the host as text instead (as the phone's meta line gives it), then the named ID.
 * Only the host's text truncates in a narrow column; its new-tab arrow always shows.
 */
function Verify({ entry }: RowProps): ReactElement {
  if (!entry.link) return <span className="text-faint">No link</span>;
  return (
    <span className={VERIFY_CLASS}>
      {/* biome-ignore lint/a11y/useAnchorContent: a redundant pointer target for the row's title link (same href), kept out of the tab order and the accessibility tree on purpose so keyboard and screen reader users meet each credential once; the sr-only host after it carries the text. */}
      <a
        href={entry.link.href}
        target="_blank"
        rel="noopener noreferrer"
        tabIndex={-1}
        aria-hidden="true"
        className={HOST_LINK_CLASS}
      >
        <span className={HOST_TEXT_CLASS}>{entry.link.host}</span>
        <NewTabArrow />
      </a>
      <span className="sr-only">{entry.link.host}</span>
      {entry.credentialId && (
        <span className={ID_CLASS} title={entry.credentialId}>
          <span className="sr-only">Credential ID</span> {entry.credentialId}
        </span>
      )}
    </span>
  );
}

/** One certificate. */
export function LedgerRow({ entry }: RowProps): ReactElement {
  const phoneMeta = [entry.issuer, entry.month?.short, entry.link?.host]
    .filter(Boolean)
    .join(' · ');
  return (
    <tr data-cert-row="" className={ROW_CLASS}>
      <td className={TITLE_CELL_CLASS}>
        <CertificateTitle entry={entry} />
        {entry.skills.length > 0 && <p className={SKILLS_CLASS}>{entry.skills.join(' · ')}</p>}
        <p className={PHONE_META_CLASS}>{phoneMeta}</p>
      </td>
      <td className={DESKTOP_CELL_CLASS}>{entry.issuer}</td>
      <td className={cn(DESKTOP_CELL_CLASS, 'text-right')}>
        {entry.month && <time dateTime={entry.month.iso}>{entry.month.short}</time>}
      </td>
      <td className={DESKTOP_CELL_CLASS}>
        <Verify entry={entry} />
      </td>
    </tr>
  );
}
