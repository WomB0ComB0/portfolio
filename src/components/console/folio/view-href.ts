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
 * @file A page's views in the URL (`?view=index`), pure. The default view has no parameter, so
 * old links and the canonical URL stay as they are. Every other parameter (the search and the
 * chips) is carried across in its order, so switching views keeps the filters, as Places | Photos
 * does.
 */

/** Next's searchParams, as a page receives them. */
export type SearchParamsRecord = Readonly<Record<string, string | readonly string[] | undefined>>;

export interface ViewParamOptions<V extends string> {
  /** The view with no parameter. */
  readonly defaultView: V;
  /** The parameter's name; 'view' by default. */
  readonly param?: string;
}

/** A view as the switch draws it. */
export interface ViewSwitchItem<V extends string> {
  readonly value: V;
  readonly label: string;
  readonly href: string;
}

const DEFAULT_PARAM = 'view';

function splitOnce(text: string, mark: string): [string, string] {
  const at = text.indexOf(mark);
  return at < 0 ? [text, ''] : [text.slice(0, at), text.slice(at + 1)];
}

/** Next's searchParams (or URLSearchParams) as a query string: '' or '?q=rust&kind=cli'. */
export function toSearch(params: SearchParamsRecord | URLSearchParams): string {
  const search = new URLSearchParams();
  const entries: Iterable<[string, string | readonly string[] | undefined]> =
    params instanceof URLSearchParams ? params.entries() : Object.entries(params);
  for (const [key, value] of entries) {
    if (value === undefined) continue;
    for (const one of typeof value === 'string' ? [value] : value) search.append(key, one);
  }
  const query = search.toString();
  return query === '' ? '' : `?${query}`;
}

/**
 * The href of `view` from the page's current href (path and query): the view parameter set, or
 * removed for the default view, and every other parameter kept in order. A #hash is dropped, as
 * a chapter in one view may not exist in another.
 */
export function viewHref<V extends string>(
  href: string,
  view: V,
  { defaultView, param = DEFAULT_PARAM }: ViewParamOptions<V>,
): string {
  const [beforeHash] = splitOnce(href, '#');
  const [path, query] = splitOnce(beforeHash, '?');
  const search = new URLSearchParams(query);
  search.delete(param);
  if (view !== defaultView) search.set(param, view);
  const next = search.toString();
  return next === '' ? path : `${path}?${next}`;
}

/** The view a URL asks for: the parameter if it names a known view, else the default. */
export function parseView<V extends string>(
  raw: string | readonly string[] | undefined,
  views: readonly V[],
  defaultView: V,
): V {
  const value = typeof raw === 'string' ? raw : raw?.[0];
  return views.find((view) => view === value) ?? defaultView;
}

/** Every view's link from the page's current href, ready for ViewSwitch. */
export function viewLinks<V extends string>(
  href: string,
  views: readonly { readonly value: V; readonly label: string }[],
  options: ViewParamOptions<V>,
): ViewSwitchItem<V>[] {
  return views.map(({ value, label }) => ({ value, label, href: viewHref(href, value, options) }));
}
