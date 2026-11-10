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
 * @file The place card's footer link (the owner's "Keep B (quiet)" from the lab): a small folder
 * whose photo slivers fan out on hover with a fine pointer, or at once on keyboard focus, and
 * stay at rest on touch. Server-safe and CSS only, so it is the same with or without JavaScript.
 * The folder is decorative; the link reads "5 photos of <place>". A place with no photos gets a
 * plain "Details of <place>" link instead: an empty folder would promise photos that aren't
 * there. Either way it opens the place page, which has the whole photos and the viewer.
 */

import Image from 'next/image';
import Link from 'next/link';
import type { ReactElement } from 'react';

import { LinkPending } from '@/components/data/link-pending';
import styles from './photo-folder.module.css';

/** The slivers' open size in px: 2x is the 96 x 64 crop the server builds. */
const SLIVER_WIDTH = 36;
const SLIVER_HEIGHT = 24;
/** The folder holds this many slivers at most. */
const MAX_SLIVERS = 3;

export interface PhotoFolderProps {
  /** The place page. */
  readonly href: string;
  /** How many photos the place page shows. */
  readonly count: number;
  /** Up to three small crops; any more are ignored. */
  readonly slivers: readonly string[];
  /** The place, for the link's name: "5 photos of <place>". */
  readonly placeName: string;
}

/**
 * The card's link to its place page: the quiet folder and "N photos", or "Details" with none.
 * Holds one LinkPending: the place page has no loading.tsx (it answers real 404s), so the spinner
 * is the click feedback.
 */
export function PhotoFolder({ href, count, slivers, placeName }: PhotoFolderProps): ReactElement {
  const pending = <LinkPending className={styles.pending} />;
  if (count === 0) {
    return (
      <Link href={href} className={styles.link}>
        <span className={styles.label}>
          Details <span className="sr-only">of {placeName}</span>
        </span>
        {pending}
      </Link>
    );
  }
  return (
    <Link href={href} className={styles.link}>
      <span className={styles.folder} aria-hidden="true" data-photo-folder="">
        <span className={styles.back} />
        {slivers.slice(0, MAX_SLIVERS).map((src) => (
          <Image
            key={src}
            src={src}
            alt=""
            width={SLIVER_WIDTH}
            height={SLIVER_HEIGHT}
            className={styles.sliver}
            draggable={false}
          />
        ))}
        <span className={styles.front} />
      </span>
      <span className={styles.label}>
        <span className={styles.count}>{count}</span> {count === 1 ? 'photo' : 'photos'}
        {/* A space outside the hidden span: browsers drop one inside it when they build the
            link's name ("5 photosof X"). */}{' '}
        <span className="sr-only">of {placeName}</span>
      </span>
      {pending}
    </Link>
  );
}
