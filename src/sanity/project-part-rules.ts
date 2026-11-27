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
 * @file The rules for a project's parts ("How it fits together"), in one place for every side
 * that applies them: the Studio fields (src/sanity/schemaTypes/project-parts.ts) check them
 * before Publish, and the /projects view model
 * (src/app/(routes)/(main)/(professioal)/projects/_lib/project-parts.ts) reads them to build the
 * card count, the page section and the technology filter. So Studio warns about exactly the
 * repository the site would treat as the same one, and both stop at the same number of parts.
 *
 * No imports: the Studio's own build loads this by a relative path (it does not resolve the app's
 * '@/' alias), and the view model runs on the server and in nothing that needs more.
 */

/** Below this a project reads as one repository: no card note, no section, no extra tech. */
export const MIN_PARTS = 2;

/**
 * Studio's caps: the longest name, role line, "My part" and lead sentence, and the number of
 * parts, where above `soft` Studio only warns and above `max` it refuses to publish.
 */
export const PART_LIMITS = {
  name: 60,
  role: 120,
  contribution: 240,
  summary: 240,
  soft: 8,
  max: 12,
} as const;

/** A whole web address starts with its scheme and '//' (the same rule as project-links.ts). */
const WEB_ADDRESS = /^https?:\/\//iu;
/** An owner or repository name as GitHub allows it; anything encoded or stranger is not one. */
const NAME_SEGMENT = /^[A-Za-z0-9_.-]+$/u;
const GIT_SUFFIX = /\.git$/iu;
/** Hosts whose first path segments name a repository, so a row's link text can be owner/repo. */
const CODE_HOSTS: ReadonlySet<string> = new Set(['github.com', 'gitlab.com', 'bitbucket.org']);
/** GitLab nests groups, then puts its own pages (tree, blob, issues) after a '-' segment. */
const GITLAB_PAGES = '-';
/**
 * Exactly 'owner/repo'. Each side is one run of characters that excludes '/', so the check is
 * linear on any text Studio holds.
 */
const REPO_SLUG = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;

/** The address as a URL when it is a whole http or https address, else null. */
function webUrlOf(value: string | null | undefined): URL | null {
  const text = (value ?? '').trim();
  if (!WEB_ADDRESS.test(text)) return null;
  try {
    return new URL(text);
  } catch {
    return null;
  }
}

/** The host without a leading 'www.' (the URL parser has already lower-cased it). */
const bareHostOf = (url: URL): string => url.hostname.replace(/^www\./u, '');

/** The path's non-empty segments, as the address encodes them. */
const segmentsOf = (url: URL): string[] => url.pathname.split('/').filter((segment) => segment);

/**
 * 'owner/repo' for https://github.com/<owner>/<repo>, dropping '.git', a trailing slash and
 * anything after the repository ('/tree/main', a query, a hash); case kept. null for an
 * organisation root or a profile (one segment), another host, or text that is not a web address.
 *
 * @example
 * repoPathOf('https://github.com/example-org/example-repo.git') // 'example-org/example-repo'
 * repoPathOf('https://github.com/resq-software') // null
 */
export function repoPathOf(url: string | null | undefined): string | null {
  const parsed = webUrlOf(url);
  if (!parsed || bareHostOf(parsed) !== 'github.com') return null;
  const [owner = '', name = ''] = segmentsOf(parsed);
  const repo = name.replace(GIT_SUFFIX, '');
  return NAME_SEGMENT.test(owner) && NAME_SEGMENT.test(repo) ? `${owner}/${repo}` : null;
}

/**
 * The same GitHub repository, compared case-insensitively, as GitHub itself does
 * ('lluciiiia/sparkmind' is 'lluciiiia/SparkMind'). An organisation root names no repository,
 * so it never matches, not even itself.
 */
export function isSameRepo(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = repoPathOf(a);
  const right = repoPathOf(b);
  return left !== null && right !== null && left.toLowerCase() === right.toLowerCase();
}

/** The repository segments of a code host's path, else null for a root with fewer than two. */
function codePathOf(host: string, segments: readonly string[]): string | null {
  const end = host === 'gitlab.com' ? segments.indexOf(GITLAB_PAGES) : 2;
  const repoSegments = segments.slice(0, end === -1 ? undefined : end);
  const owners = repoSegments.slice(0, -1);
  const repo = (repoSegments.at(-1) ?? '').replace(GIT_SUFFIX, '');
  return owners.length > 0 && repo ? [...owners, repo].join('/') : null;
}

/**
 * A row's link text: 'owner/repo' on github.com, gitlab.com (with its subgroups) or
 * bitbucket.org; otherwise the host and path, without 'www.', a query or a hash. Text that is not
 * a web address comes back trimmed, though the view model only labels addresses it links.
 */
export function repoLabelOf(url: string): string {
  const parsed = webUrlOf(url);
  if (!parsed) return url.trim();
  const host = bareHostOf(parsed);
  const segments = segmentsOf(parsed);
  const codePath = CODE_HOSTS.has(host) ? codePathOf(host, segments) : null;
  return codePath ?? [host, ...segments].join('/');
}

/**
 * Text shaped exactly like 'owner/repo', trimmed. 'API / CDN' and 'CI/CD pipeline' are not; a
 * bare 'CI/CD' is, which is harmless because Studio only warns with it.
 */
export const looksLikeRepoSlug = (text: string): boolean => REPO_SLUG.test(text.trim());
