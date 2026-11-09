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
 * @file One certificate's row in the Ledger (style 1, the ruled ledger), rendered on the server
 * and handed to the filter island as markup. Server-safe (no directive, no hooks); the Copy ID
 * button inside it is the one client part.
 *
 * On a wide page the row is four cells on one 40px line: the title (the row's one link, stretched
 * over the whole row, to the credential in a new tab) with its skills faint beside it, the issuer
 * as written on the credential, the month (the year bar holds the year), and Verify: the platform
 * in muted text that turns brand-ink with the row, its one arrow, and Copy ID above the row's
 * link. On a phone the other cells are hidden and the title cell carries one meta line instead:
 * "Issuer · Mon · Platform".
 */

import type { ReactElement } from 'react';

import {
  INDEX_META_CLASS,
  INDEX_ROW_INK_CLASS,
  INDEX_TITLE_TEXT_CLASS,
  IndexCopyButton,
  IndexRow,
  IndexTitleLink,
  indexCellClass,
} from '@/components/console/index-table';
import { NewTabArrow } from '@/components/console/tile-link';
import { cn } from '@/lib/utils';
import type { LedgerEntry } from '../_lib/ledger';
import {
  ID_SLOT_CLASS,
  LEDGER_COLUMNS,
  PLATFORM_CLASS,
  SKILLS_CLASS,
  TITLE_LINE_CLASS,
  VERIFY_CLASS,
} from './ledger-classes';

const [TITLE, ISSUER, ISSUED, VERIFY] = LEDGER_COLUMNS;

interface RowProps {
  readonly entry: LedgerEntry;
}

/** The title: the row's link to the credential, or plain text when it has none. */
function CertificateTitle({ entry }: RowProps): ReactElement {
  if (!entry.link) {
    return (
      <span data-cert-title="" className={INDEX_TITLE_TEXT_CLASS}>
        {entry.title}
      </span>
    );
  }
  return (
    <IndexTitleLink data-cert-title="" href={entry.link.href} external>
      {entry.title}
    </IndexTitleLink>
  );
}

/**
 * Verify: the platform and its arrow (the row's link already goes there, so this is text, not a
 * second link), then Copy ID, or an empty slot so the platforms line up. Screen readers also get
 * the credential ID itself, named, so it can be checked by hand with the issuer.
 */
function Verify({ entry }: RowProps): ReactElement {
  const { link, credentialId, title } = entry;
  return (
    <span className={VERIFY_CLASS}>
      {link ? (
        <span className={cn(PLATFORM_CLASS, INDEX_ROW_INK_CLASS)}>
          <span className="min-w-0 truncate">{link.platform}</span>
          <NewTabArrow />
        </span>
      ) : (
        <span className="text-faint">No link</span>
      )}
      {credentialId ? (
        <>
          <span className="sr-only">Credential ID {credentialId}</span>
          <IndexCopyButton value={credentialId} label={`the credential ID for ${title}`} />
        </>
      ) : (
        <span aria-hidden="true" className={ID_SLOT_CLASS} />
      )}
    </span>
  );
}

/** One certificate. */
export function LedgerRow({ entry }: RowProps): ReactElement {
  const phoneMeta = [entry.issuer, entry.month?.name, entry.link?.platform ?? 'No link']
    .filter(Boolean)
    .join(' · ');
  return (
    <IndexRow data-cert-row="">
      <td className={indexCellClass(TITLE)}>
        <span className={TITLE_LINE_CLASS}>
          <CertificateTitle entry={entry} />
          {entry.skills.length > 0 && (
            <span className={SKILLS_CLASS}>{entry.skills.join(' · ')}</span>
          )}
        </span>
        <span className={INDEX_META_CLASS}>{phoneMeta}</span>
      </td>
      <td className={indexCellClass(ISSUER)}>{entry.issuer}</td>
      <td className={indexCellClass(ISSUED)}>
        {entry.month && (
          <time dateTime={entry.month.iso}>
            {entry.month.name}
            <span className="sr-only"> {entry.month.year}</span>
          </time>
        )}
      </td>
      <td className={indexCellClass(VERIFY)}>
        <Verify entry={entry} />
      </td>
    </IndexRow>
  );
}
