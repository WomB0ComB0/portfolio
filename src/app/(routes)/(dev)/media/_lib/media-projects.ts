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
 * @file Which project of this site a /media item is about, so its row can point at the project's
 * page ("Project: Product Decoder") and the project's page back at it. Pure; the server calls it
 * (load-feed.ts, load-project-media.ts) and the island never imports it.
 *
 * The page says so by itself only on evidence: the item's own text links the project. For a
 * video that is its YouTube description; for a post, its excerpt. A link counts when it is
 *  - the project's repository, or anything inside it (a file, an issue), on GitHub, GitLab or
 *    Bitbucket, whatever the letter case; or
 *  - the project's live address, or the address of an organisation that is the project, exactly:
 *    the same host and path. A page under a live address is not it (a short link is not about
 *    the link shortener), and a repository is not its owner's profile.
 *
 * A wrong reference is worse than none, so:
 *  - A live address on this site's own host, or on a subdomain of it, is never read
 *    (ProjectRules.siteHost). Any upload may list the site it is shown on ("my site: ...") and the
 *    owner's other addresses under it, so such an address says nothing about one of them, and a
 *    relation that rested on it would come and go with how many others list it. The repository
 *    still counts; an item about the site, or a project under it, is stated in the map.
 *  - Titles and descriptions are never read for names. "Portfolio tips" says nothing about a
 *    portfolio project, and a project called "synapse" is not every mention of a synapse.
 *  - An address more than PROJECT_FAN_MAX items link is a template line (a footer every upload
 *    repeats), not a statement about one of them: it is not read.
 *  - An item that links two projects is a round-up and is about neither; an address two projects
 *    share names neither.
 * Everything else goes through the hand-written map (media-project-links.ts): a rule relates an
 * item nothing links and wins over a link, and the block list stops one relation. A rule marked
 * `proposed` is a draft from the titles: it never reaches the page, and the lab shows it only
 * while the item's title still holds the project's distinctive name ({@link titleNamesProject}).
 */

import { type FeedEntry, type FeedProject, type FeedSources, postHref } from './media-feed';
import { entryKey, itemKey, linksIn, urlKey } from './media-links';
import type { MediaProjectRule } from './media-project-links';

export type { FeedProject } from './media-feed';

/** What the matcher reads of a project. */
export interface ProjectRef {
  /** The project's id: the last part of /projects/<id>. */
  readonly id: string;
  readonly title: string;
  readonly liveUrl?: string | null;
  readonly githubUrl?: string | null;
}

/** A project document, as far as the matcher needs it (Sanity's Project fits). */
export interface ProjectDocument {
  readonly _id: string;
  readonly title: string;
  readonly liveUrl?: string | null;
  readonly githubUrl?: string | null;
}

/** Project documents as the matcher reads them: the id, the title and the two addresses. */
export const projectRefs = (projects: readonly ProjectDocument[]): ProjectRef[] =>
  projects.map(({ _id, title, liveUrl, githubUrl }) => ({ id: _id, title, liveUrl, githubUrl }));

/** An item, by its key, and every link its own text holds. */
export interface ItemLinks {
  readonly item: string;
  readonly links: readonly string[];
}

/** The map's two lists, and the one host whose live addresses the matcher does not read. */
export interface ProjectRules {
  readonly links: readonly MediaProjectRule[];
  readonly notLinks: readonly MediaProjectRule[];
  /**
   * This site's own host ("example.dev"). A project's live address on it is no evidence: any item
   * may list the site it is shown on. Left out, every live address is read.
   */
  readonly siteHost?: string;
}

/** A drafted relation the lab may show: the entry and the project the map proposes for it. */
export interface ProjectProposal {
  readonly entryId: string;
  readonly project: FeedProject;
}

/** The most items that may link one address before it reads as a template line. */
export const PROJECT_FAN_MAX = 3;

/** Hosts where an address is owner/repository, the path's case does not matter. */
const CODE_HOSTS: ReadonlySet<string> = new Set(['github.com', 'gitlab.com', 'bitbucket.org']);
/** GitLab writes a repository's own pages after "/-/", so a group may nest any depth before it. */
const GITLAB_HOST = 'gitlab.com';
const GITLAB_PAGES = '-';
/** Owner and repository. */
const REPOSITORY_SEGMENTS = 2;

/** The segments that name a repository (or its owner alone) on a code host. */
function repositorySegments(host: string, segments: readonly string[]): readonly string[] {
  if (host !== GITLAB_HOST) return segments.slice(0, REPOSITORY_SEGMENTS);
  const pages = segments.indexOf(GITLAB_PAGES);
  return pages === -1 ? segments : segments.slice(0, pages);
}

/**
 * A link as the address a project may be known by. On a code host: the owner and repository in
 * lower case, without ".git" and without whatever page of the repository the link opens. Anywhere
 * else: the host and path as they are. Null when the link is not an http(s) address or names
 * nothing (a code host's home page).
 */
export function addressKey(link: string): string | null {
  const key = urlKey(link);
  if (key === null) return null;
  const [host = '', ...segments] = key.slice('url:'.length).split('/');
  if (!CODE_HOSTS.has(host)) return key;
  const named = repositorySegments(host, segments.filter(Boolean));
  if (named.length === 0) return null;
  return `code:${host}/${named.join('/').replace(/\.git$/i, '')}`.toLowerCase();
}

/**
 * What each item's own text links: a video's description, a post's excerpt. Keys and raw links
 * only; which of them are a project's address is relateProjects' business.
 */
export function projectSignals(sources: Partial<FeedSources>): ItemLinks[] {
  const videos = (sources.videos ?? []).map((video) => ({
    item: `yt:${video.videoId}`,
    links: linksIn(video.description),
  }));
  const posts = (sources.posts ?? []).flatMap((post) => {
    const href = postHref(post);
    const item = href === null ? null : urlKey(href);
    return item === null ? [] : [{ item, links: linksIn(post.excerpt) }];
  });
  return [...videos, ...posts];
}

/** An address's host as urlKey writes it (lower case, no "www."); null when it is no address. */
const hostOf = (url: string): string | null =>
  urlKey(url)?.slice('url:'.length).split('/')[0] ?? null;

/** Whether `host` is the site's own host or a subdomain of it ("links.example.dev"). */
const onSiteHost = (host: string | null, siteHost: string): boolean =>
  host !== null && (host === siteHost || host.endsWith(`.${siteHost}`));

/**
 * The addresses a project is known by, as keys: its repository, and its live address unless that
 * is on the site's own host or a subdomain of it (see the file comment).
 */
function evidenceAddresses(project: ProjectRef, siteHost: string | null): string[] {
  const live = project.liveUrl;
  const readLive = live && (siteHost === null || !onSiteHost(hostOf(live), siteHost));
  return [project.githubUrl, readLive ? live : null].flatMap((url) => {
    const address = url ? addressKey(url) : null;
    return address === null ? [] : [address];
  });
}

/**
 * Each address to the one project known by it; an address two projects share is left out, and
 * so is a live address on `siteHost`.
 */
function projectsByAddress(
  projects: readonly ProjectRef[],
  siteHost: string | null,
): Map<string, string> {
  const owners = new Map<string, Set<string>>();
  for (const project of projects) {
    for (const address of evidenceAddresses(project, siteHost)) {
      owners.set(address, (owners.get(address) ?? new Set<string>()).add(project.id));
    }
  }
  const byAddress = new Map<string, string>();
  for (const [address, ids] of owners) {
    const [only] = ids;
    if (ids.size === 1 && only !== undefined) byAddress.set(address, only);
  }
  return byAddress;
}

/**
 * Each item to the one project its links name: template addresses dropped first, and an item
 * that then names two projects (or none) is left out.
 */
function evidenceByItem(
  signals: readonly ItemLinks[],
  byAddress: ReadonlyMap<string, string>,
): Map<string, string> {
  const addressesOf = new Map<string, Set<string>>();
  for (const { item, links } of signals) {
    const addresses = addressesOf.get(item) ?? new Set<string>();
    for (const link of links) {
      const address = addressKey(link);
      if (address !== null && byAddress.has(address)) addresses.add(address);
    }
    addressesOf.set(item, addresses);
  }
  const fan = new Map<string, number>();
  for (const addresses of addressesOf.values()) {
    for (const address of addresses) fan.set(address, (fan.get(address) ?? 0) + 1);
  }
  const evidence = new Map<string, string>();
  for (const [item, addresses] of addressesOf) {
    const named = new Set(
      [...addresses]
        .filter((address) => (fan.get(address) ?? 0) <= PROJECT_FAN_MAX)
        .map((address) => byAddress.get(address)),
    );
    const [only] = named;
    if (named.size === 1 && only !== undefined) evidence.set(item, only);
  }
  return evidence;
}

interface ReadRule {
  readonly item: string;
  readonly project: string;
  readonly proposed: boolean;
}

/** The rules as keys, unreadable ones dropped. */
function readRules(rules: readonly MediaProjectRule[]): ReadRule[] {
  return rules.flatMap((rule) => {
    const item = itemKey(rule.item);
    const project = rule.project.trim();
    return item === null || project === ''
      ? []
      : [{ item, project, proposed: rule.proposed === true }];
  });
}

/** One relation as a string, for the blocked set. */
const relationId = (item: string, project: string): string => `${item} ${project}`;

const blockedBy = (rules: ProjectRules): ReadonlySet<string> =>
  new Set(readRules(rules.notLinks).map(({ item, project }) => relationId(item, project)));

/** An entry with its project, which a search then reads too. */
const withProject = (entry: FeedEntry, project: FeedProject): FeedEntry => ({
  ...entry,
  project,
  haystack: `${entry.haystack} ${project.title}`,
});

/**
 * The entries, each with the project it is about: the map's confirmed rule first, then the one
 * project its own links name (see the file comment). A project that is not in `projects`, and a
 * relation on the block list, is never shown. Returns new entries in the same order; the input is
 * not modified.
 */
export function relateProjects(
  entries: readonly FeedEntry[],
  signals: readonly ItemLinks[],
  projects: readonly ProjectRef[],
  rules: ProjectRules,
): FeedEntry[] {
  const byId = new Map(projects.map((project) => [project.id, project]));
  const blocked = blockedBy(rules);
  const siteHost = rules.siteHost ? hostOf(`https://${rules.siteHost}`) : null;
  const evidence = evidenceByItem(signals, projectsByAddress(projects, siteHost));
  const confirmed = new Map<string, string>();
  for (const rule of readRules(rules.links)) {
    if (!rule.proposed && !confirmed.has(rule.item)) confirmed.set(rule.item, rule.project);
  }
  return entries.map((entry) => {
    const key = entryKey(entry);
    if (key === null) return { ...entry };
    const id = [confirmed.get(key), evidence.get(key)].find(
      (each) => each !== undefined && byId.has(each) && !blocked.has(relationId(key, each)),
    );
    const project = id === undefined ? undefined : byId.get(id);
    return project
      ? withProject(entry, { id: project.id, title: project.title, proposed: false })
      : { ...entry };
  });
}

/**
 * Where a project's own name ends in its title: " - ", " – ", ": ", " | " or a bracket. A space
 * run is matched only from its start, so a long one (titles have no cap) is read once; the name
 * before the first match is the same.
 */
const NAME_END = /(?<!\s)\s+[-–—|]\s+|:\s+|(?<!\s)\s*[([]/;
/** A one-word name that could not be an ordinary word: a capital, digit, dot or hyphen inside. */
const COINED_WORD = /^.+[\p{Lu}\p{N}._-]/u;

/**
 * The part of a project's title that is its own name, when it is distinctive enough to look for
 * in another title: two words or more ("Fraud Guard"), or one coined word ("SparkMind",
 * "example.dev", "ui-capture"). Null for one ordinary-looking word ("synapse", "Ralph"), which
 * could be anything.
 */
export function distinctiveName(projectTitle: string): string | null {
  const name = projectTitle.split(NAME_END)[0]?.trim() ?? '';
  if (name === '') return null;
  const words = name.split(/\s+/).filter(Boolean);
  return words.length > 1 || COINED_WORD.test(name) ? name : null;
}

const escapeForPattern = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Whether an item's title holds a project's distinctive name: the same letters in any case, as
 * whole words ("Sparkmind - Calendar scope" names SparkMind; "Sparkminds" does not). The rule
 * proposals are drafted by, and the one the lab checks them against.
 */
export function titleNamesProject(itemTitle: string, projectTitle: string): boolean {
  const name = distinctiveName(projectTitle);
  if (name === null) return false;
  const words = name.split(/\s+/).map(escapeForPattern).join('\\s+');
  return new RegExp(`(?<![\\p{L}\\p{N}])${words}(?![\\p{L}\\p{N}])`, 'iu').test(itemTitle);
}

/**
 * The map's proposals that still hold: the item is in the feed and has no project yet, the
 * project is published, the relation is not on the block list, and the item's title names the
 * project ({@link titleNamesProject}). One per item, the first. For the lab; /media never calls it.
 */
export function proposedProjects(
  entries: readonly FeedEntry[],
  projects: readonly ProjectRef[],
  rules: ProjectRules,
): ProjectProposal[] {
  const byId = new Map(projects.map((project) => [project.id, project]));
  const blocked = blockedBy(rules);
  const proposals = new Map<string, ProjectProposal>();
  for (const rule of readRules(rules.links)) {
    const entry = entries.find((each) => entryKey(each) === rule.item);
    const project = byId.get(rule.project);
    if (!rule.proposed || !entry || !project || entry.project !== null) continue;
    if (proposals.has(entry.id) || blocked.has(relationId(rule.item, project.id))) continue;
    if (!titleNamesProject(entry.title, project.title)) continue;
    proposals.set(entry.id, {
      entryId: entry.id,
      project: { id: project.id, title: project.title, proposed: true },
    });
  }
  return [...proposals.values()];
}

/**
 * The entries with each proposal set on the entry it names, unless that entry already has a
 * project. Returns new entries; the input is not modified.
 */
export function applyProposals(
  entries: readonly FeedEntry[],
  proposals: readonly ProjectProposal[],
): FeedEntry[] {
  const byEntry = new Map(proposals.map((proposal) => [proposal.entryId, proposal.project]));
  return entries.map((entry) => {
    const project = byEntry.get(entry.id);
    return project && entry.project === null ? withProject(entry, project) : entry;
  });
}
