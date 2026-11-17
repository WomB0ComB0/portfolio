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
 * @file A credential set large (a thin year's, or a Featured one): the title at headline size,
 * the issuer and month as its byline, up to three of its skills, then 'Verify on Credly ↗' at body
 * size ('View certificate ↗' for a stored file) and Copy ID. Server-safe (no directive, no hooks):
 * the Featured chapter draws it on the server
 * and the filter island in its results. Copy ID is the one client part.
 */

import type { CSSProperties, ReactElement } from 'react';
import { Byline, widestWordUnits } from '@/components/console/folio';
import { IndexCopyButton } from '@/components/console/index-table';
import { NEW_TAB_LABEL, NewTabArrow, SrOnlyWords } from '@/components/console/tile-link';
import { LinkHealthBadge } from '@/components/link-health/link-health-badge';
import type { CredentialLink } from '../_lib/format';
import type { LedgerEntry } from '../_lib/ledger';
import { NO_LINK_NOTE } from '../_lib/record';
import {
  BIG_BYLINE_CLASS,
  BIG_ITEM_CLASS,
  BIG_LIST_CLASS,
  BIG_SKILLS_CLASS,
  BIG_TITLE_CLASS,
  NO_LINK_CLASS,
  VERIFY_LINK_CLASS,
  VERIFY_ROW_CLASS,
} from './record-classes';
import { SkillsLine } from './skills-line';

/** What a stored file's link says: it shows the certificate, and claims no one verifies it. */
export const VIEW_FILE_LABEL = 'View certificate';

/** What a credential shows of a certificate. */
export type CredentialEntry = Pick<
  LedgerEntry,
  'id' | 'title' | 'issuer' | 'month' | 'link' | 'credentialId' | 'skills'
>;

interface CredentialProps {
  readonly entry: CredentialEntry;
}

/**
 * Copy ID: copies the credential ID and says so in the page's polite line. Screen readers also
 * hear the ID itself, named, so it can be checked by hand with the issuer.
 */
export function CredentialCopy({ entry }: CredentialProps): ReactElement | null {
  const { credentialId, title } = entry;
  if (!credentialId) return null;
  return (
    <>
      <span className="sr-only">Credential ID {credentialId}</span>
      <IndexCopyButton value={credentialId} label={`the credential ID for ${title}`} />
    </>
  );
}

/** The words a credential's link shows: where it verifies, or that it is a stored file. */
export const verifyWords = (link: CredentialLink): string =>
  link.verifies ? `Verify on ${link.platform}` : VIEW_FILE_LABEL;

/**
 * 'Verify on Credly ↗' ('View certificate ↗' for a PDF on a file host, which vouches for
 * nothing), opening the credential in a new tab. Its name starts with the words it shows, then
 * the title, so a list of links never reads as many alike 'Verify on Credly'.
 */
function VerifyLink({ entry }: CredentialProps): ReactElement {
  if (!entry.link) return <span className={NO_LINK_CLASS}>{NO_LINK_NOTE}</span>;
  return (
    <a
      href={entry.link.href}
      target="_blank"
      rel="noopener noreferrer"
      data-verify=""
      data-cert-file={entry.link.verifies ? undefined : ''}
      className={VERIFY_LINK_CLASS}
    >
      <span>
        {verifyWords(entry.link)}
        <span className="sr-only">, {entry.title}</span>
        <NewTabArrow />
        <SrOnlyWords>{NEW_TAB_LABEL}</SrOnlyWords>
      </span>
    </a>
  );
}

/** One credential, set large. */
export function BigCredential({ entry }: CredentialProps): ReactElement {
  const fit = { '--folio-fit': String(widestWordUnits(entry.title)) } as CSSProperties;
  return (
    <li data-cert-item="" data-cert-size="big" className={BIG_ITEM_CLASS}>
      <h3 data-cert-title="" className={BIG_TITLE_CLASS} style={fit}>
        {entry.title}
      </h3>
      <Byline parts={[entry.issuer, entry.month?.short]} className={BIG_BYLINE_CLASS} />
      <SkillsLine skills={entry.skills} className={BIG_SKILLS_CLASS} />
      <p className={VERIFY_ROW_CLASS}>
        <VerifyLink entry={entry} />
        {entry.link && <LinkHealthBadge href={entry.link.href} scope="certifications" />}
        <CredentialCopy entry={entry} />
      </p>
    </li>
  );
}

/** Credentials set large, two to a row from a 48rem page. */
export function BigCredentials({
  entries,
}: {
  readonly entries: readonly CredentialEntry[];
}): ReactElement {
  return (
    <ul className={BIG_LIST_CLASS}>
      {entries.map((entry) => (
        <BigCredential key={entry.id} entry={entry} />
      ))}
    </ul>
  );
}
