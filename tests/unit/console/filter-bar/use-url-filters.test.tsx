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
 * @file useUrlFilters, the nuqs-backed source /projects and /places will use: it reads the URL
 * through the schema (old links resolve), writes every change back with history replace and
 * repeated keys, filters as you type with no debounce, and builds the same FilterModel the parts
 * read. nuqs' own testing adapter stands in for the router.
 */

import { act, cleanup, render, screen } from '@testing-library/react';
import { NuqsTestingAdapter, type UrlUpdateEvent } from 'nuqs/adapters/testing';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { type FilterModel, useUrlFilters } from '@/components/console/filter-bar';
import { PROJECTS, projects } from '../../filters/filters-fixture';

afterEach(cleanup);

let latest: { model: FilterModel; titles: string[] } | null = null;

function Probe(): ReactElement {
  const { model, results } = useUrlFilters(projects, PROJECTS);
  latest = { model, titles: results.map((project) => project.title) };
  return <p data-testid="shown">{results.length}</p>;
}

type UrlSpy = ReturnType<typeof vi.fn<(event: UrlUpdateEvent) => void>>;

function renderAt(search: string): { onUrlUpdate: UrlSpy; model: () => FilterModel } {
  const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>();
  render(
    <NuqsTestingAdapter searchParams={search} onUrlUpdate={onUrlUpdate} hasMemory>
      <Probe />
    </NuqsTestingAdapter>,
  );
  /** The model the Probe rendered last, read when called; throws if no Probe has rendered. */
  const model = (): FilterModel => {
    if (!latest) throw new Error('not rendered');
    return latest.model;
  };
  return { onUrlUpdate, model };
}

/** The URL nuqs writes after `act`: its queue flushes on a later tick, so this waits for it. */
async function nextUrl(spy: UrlSpy, act: () => void): Promise<UrlUpdateEvent> {
  const before = spy.mock.calls.length;
  await actOn(act);
  await vi.waitFor(() => expect(spy.mock.calls.length).toBeGreaterThan(before));
  const event = spy.mock.calls.at(-1)?.[0];
  if (!event) throw new Error('no URL update');
  return event;
}

const actOn = (run: () => void): Promise<void> =>
  act(async () => {
    run();
  });

describe('useUrlFilters', () => {
  it('reads the URL through the schema, old links included', () => {
    const { model } = renderAt(
      '?category=CLI%20Tool%20/%20Python%20/%20File%20Management&tech=ReactJS',
    );

    expect(model().draft).toEqual({ q: '', category: ['tools'], tech: ['react'] });
    expect(screen.getByTestId('shown')).toHaveTextContent('0');
    expect(model().options.category?.options.find((o) => o.slug === 'tools')?.count).toBe(0);
  });

  it('writes a chip, a checkbox and Clear back to the URL, replacing the entry', async () => {
    const { onUrlUpdate, model } = renderAt('');

    const chip = await nextUrl(onUrlUpdate, () => model().choose('category', 'tools'));
    expect(chip.queryString).toBe('?category=tools');
    expect(chip.options.history).toBe('replace');

    await nextUrl(onUrlUpdate, () => model().toggle('tech', 'go'));
    const both = await nextUrl(onUrlUpdate, () => model().toggle('tech', 'python'));
    expect(both.queryString).toBe('?category=tools&tech=go&tech=python');
    expect(latest?.titles).toEqual(['Alpha CLI', 'Epsilon bot']);

    const cleared = await nextUrl(onUrlUpdate, () => model().clearAll());
    expect(cleared.queryString).toBe('');
    expect(latest?.titles).toHaveLength(5);
  });

  it('filters as you type, keeps the text as typed in the field, and says so once touched', async () => {
    const { onUrlUpdate, model } = renderAt('');
    expect(model().status).toBe('');

    const typed = await nextUrl(onUrlUpdate, () => model().setQuery('  delta '));

    expect(model().draft.q).toBe('  delta ');
    expect(model().active.q).toBe('delta');
    expect(latest?.titles).toEqual(['Delta site']);
    expect(model().status).toBe('Showing 1 of 5 projects');
    expect(typed.queryString).toBe('?q=++delta+');
  });

  it('builds links from the current filters', () => {
    const { model } = renderAt('?tech=go&q=cli');

    expect(model().hrefFor({ category: 'tools' })).toBe('/projects?category=tools&tech=go&q=cli');
    expect(model().hrefFor({ tech: null })).toBe('/projects?q=cli');
  });
});
