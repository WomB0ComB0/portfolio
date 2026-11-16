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
 * @file Which project a /media item is about, where the page cannot work it out by itself, and
 * relations it works out that are wrong. The page then shows "Project: <title>" on the item's row
 * (a link to /projects/<id>) and the project's page lists the item (media-projects.ts has the
 * rules).
 *
 * In everyday use the page needs no line here: it relates an item to a project when the item's
 * own text links the project's repository or live address (a video's YouTube description, a
 * post's excerpt). Add a line only for an item whose link the page does not read, or to stop a
 * relation that is wrong. The page does not read:
 *  - a post's body (only its excerpt reaches the page);
 *  - this site's own address ({@link MEDIA_SITE_HOST}): any upload may list the site it is shown
 *    on, so the address alone says nothing about one of them.
 *
 * A rule names the item by the address its row links to (a post's URL, or a video's YouTube URL
 * or 11-character id) and the project by its id: the last part of its /projects/<id> address.
 *
 * A line is shown on /media and on the project's page unless it is marked `proposed`. Write an
 * unmarked line only on the owner's word, or on a link in the item's own text, and say above it
 * which link and where it is. `proposed: true` marks a draft from the titles that nobody has
 * confirmed. It never shows on /media or on a project's page; the routes lab shows it (Project
 * links: With proposals) while the item's title still holds the project's own name. To confirm
 * one, delete its `proposed` line; to turn it down, delete the rule. Pure and server-safe.
 *
 * @example
 * // A relation by hand (placeholder values):
 * // { item: 'https://www.youtube.com/watch?v=VIDEO_ID_11', project: 'the-project-id' },
 */

/** An item and the project it is about. */
export interface MediaProjectRule {
  /** The item, as its row links it: a post's URL, or a video's YouTube URL or 11-character id. */
  readonly item: string;
  /** The project's id: the last part of its /projects/<id> address. */
  readonly project: string;
  /** A draft from the titles, not confirmed by the owner: shown in the routes lab only. */
  readonly proposed?: true;
}

/**
 * This site's own host. A project's live address on it is never read as evidence, so the items
 * that are about the site itself are stated below. Written out, not imported: the constant that
 * holds it (SITE_HOST in src/lib/og/constants.ts) sits in an import cycle with the app constants,
 * and this map must load anywhere. A unit test keeps the two the same.
 */
export const MEDIA_SITE_HOST = 'mikeodnis.dev';

/** The project "mikeodnis.dev – Personal Portfolio": this site. */
const PORTFOLIO_PROJECT = 'ib3nmtodFyARmiBwkKzTbW';

/** Relations the page cannot work out by itself. A line that is not `proposed` wins over a link. */
export const MEDIA_PROJECTS: readonly MediaProjectRule[] = [
  // "Portfolio - revamp 3 - 2025". Its YouTube description lists this site, the project's live
  // address, as its one entry under "Resources Mentioned in the Video", and no other upload lists
  // it (read 2026-11-12; an independent review read it again on 2026-11-13). The page does not
  // read the site's own address, so the relation is stated here. It is shown on that link, not on
  // the owner's word: he has not been asked. Delete the line if it is wrong.
  { item: 'https://www.youtube.com/watch?v=DOtNqJyanOA', project: PORTFOLIO_PROJECT },
  // "Beyond Static: Creating a Dynamic Developer Portfolio with Next.js and Modern Web Tech". Its
  // body links the project's repository among its "Quick links" (the blog's feed, read
  // 2026-11-12; an independent review read it again on 2026-11-13); its excerpt, all the page
  // reads of a post, holds no link. It is shown on that link, not on the owner's word: he has not
  // been asked. Delete the line if it is wrong, or once the page reads a post's body.
  {
    item: 'https://blog.mikeodnis.dev/beyond-static-creating-a-dynamic-developer-portfolio-with-nextjs-and-modern-web-tech',
    project: PORTFOLIO_PROJECT,
  },
];

/** Relations the page works out that are wrong: this item never points at this project. */
export const MEDIA_NOT_PROJECTS: readonly MediaProjectRule[] = [];

/** Both lists and the site's host, as the matcher reads them. */
export const MEDIA_PROJECT_RULES = {
  links: MEDIA_PROJECTS,
  notLinks: MEDIA_NOT_PROJECTS,
  siteHost: MEDIA_SITE_HOST,
} as const;
