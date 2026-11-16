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
 * @file /experience's cross-lighting island (role-crosslight.tsx): pointing at a role with a
 * mouse (its stop on the rail, or its capsule on "The path so far"), or focusing it from the
 * keyboard, lights that role's capsule on the path and dims the others. Never on touch, without
 * a fine pointer or under reduced motion, and it adds no element beyond one hidden marker.
 */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.hoisted(() => {
  // app.url is read from this variable when the constants module loads.
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://mikeodnis.dev');
});

const h = vi.hoisted(() => ({
  loadExperiences: vi.fn(),
  loadProjects: vi.fn(),
  peekProjects: vi.fn(),
  reportApiFailure: vi.fn(),
}));

vi.mock('@/lib/sanity/loaders', () => ({
  loadExperiences: h.loadExperiences,
  loadProjects: h.loadProjects,
  peekProjects: h.peekProjects,
}));
vi.mock('@/lib/observability/report', () => ({ reportApiFailure: h.reportApiFailure }));
// client.ts require()s '@/env' at load; the page only needs the image URL builder.
vi.mock('@/lib/sanity/client', async () => {
  const { createImageUrlBuilder } = await import('@sanity/image-url');
  const builder = createImageUrlBuilder({ projectId: 'test', dataset: 'test' });
  return { urlFor: (source: Parameters<typeof builder.image>[0]) => builder.image(source) };
});

import ExperiencePage from '@/app/(routes)/(main)/(professioal)/experience/(list)/page';
import { capsuleOf, NOW, ROLES, stopOf, stubMedia } from './story-fixtures';

/** The capsules in a state, by role. */
const litIds = (container: HTMLElement, state: 'on' | 'off'): string[] =>
  Array.from(
    container.querySelectorAll<HTMLElement>(`[data-role-path] [data-r][data-lit="${state}"]`),
  ).map((capsule) => capsule.dataset.r ?? '');
const anyLit = (container: HTMLElement): number =>
  container.querySelectorAll('[data-role-path] [data-lit]').length;

/** A spot inside a stop the pointer can rest on: its title link. */
const titleOf = (container: HTMLElement, id: string): HTMLElement => {
  const title = stopOf(container, id).querySelector<HTMLElement>('a[data-role-page]');
  if (!title) throw new Error(`no title for ${id}`);
  return title;
};

/**
 * jsdom tracks no pointer, so nothing in it is ever :hover. Makes the island's one :hover
 * question mean "stands for `id`", as a browser answers it for a mouse that stopped on that
 * role before the island mounted.
 */
function restOn(id: string): void {
  const query = Element.prototype.querySelectorAll;
  const answer = function (this: Element, selectors: string): NodeListOf<Element> {
    return query.call(this, selectors.replace(':hover', `[data-light-role="${id}"]`));
  };
  vi.spyOn(Element.prototype, 'querySelectorAll').mockImplementation(
    answer as typeof Element.prototype.querySelectorAll,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  h.loadExperiences.mockReset();
  h.loadExperiences.mockResolvedValue(ROLES);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('/experience: cross-lighting', () => {
  it("lights a pointed-at stop's capsule on the path and dims the others, with a mouse", async () => {
    stubMedia(true);
    const { container } = render(await ExperiencePage());

    fireEvent.pointerOver(titleOf(container, 'curve'), { pointerType: 'mouse' });

    expect(litIds(container, 'on')).toEqual(['curve']);
    expect(litIds(container, 'off')).toHaveLength(ROLES.length - 1);
  });

  it('lights a capsule pointed at on the path itself the same way', async () => {
    stubMedia(true);
    const { container } = render(await ExperiencePage());

    fireEvent.pointerOver(capsuleOf(container, 'dfg'), { pointerType: 'mouse' });

    expect(litIds(container, 'on')).toEqual(['dfg']);
  });

  it('puts every capsule back when the pointer leaves, or moves off the roles', async () => {
    stubMedia(true);
    const { container } = render(await ExperiencePage());
    const clock = container.querySelector('[data-role-clock]');
    const caption = container.querySelector('[data-role-path] figcaption');
    if (!clock || !caption) throw new Error('no clock or caption');

    fireEvent.pointerOver(titleOf(container, 'curve'), { pointerType: 'mouse' });
    fireEvent.pointerOver(caption, { pointerType: 'mouse' });
    expect(anyLit(container)).toBe(0);

    fireEvent.pointerOver(titleOf(container, 'curve'), { pointerType: 'mouse' });
    fireEvent.pointerLeave(clock);
    expect(anyLit(container)).toBe(0);
  });

  it('lights for keyboard focus without a mouse, and clears when focus leaves', async () => {
    stubMedia(false);
    const { container } = render(await ExperiencePage());
    const capsule = capsuleOf(container, 'elysium');

    capsule.focus();
    expect(document.activeElement).toBe(capsule);
    expect(litIds(container, 'on')).toEqual(['elysium']);

    capsule.blur();
    expect(anyLit(container)).toBe(0);
  });

  it('never lights on touch, or without a fine pointer', async () => {
    stubMedia(true);
    const touched = render(await ExperiencePage());
    fireEvent.pointerOver(titleOf(touched.container, 'curve'), { pointerType: 'touch' });
    expect(anyLit(touched.container)).toBe(0);
    touched.unmount();

    stubMedia(false);
    const coarse = render(await ExperiencePage());
    fireEvent.pointerOver(titleOf(coarse.container, 'curve'), { pointerType: 'mouse' });
    expect(anyLit(coarse.container)).toBe(0);
  });

  it('does nothing under reduced motion', async () => {
    stubMedia(true, true);
    const { container } = render(await ExperiencePage());

    fireEvent.pointerOver(titleOf(container, 'curve'), { pointerType: 'mouse' });
    capsuleOf(container, 'curve').focus();

    expect(anyLit(container)).toBe(0);
  });

  it('lights the role a mouse already rests on when the island mounts', async () => {
    stubMedia(true);
    restOn('curve');
    const { container } = render(await ExperiencePage());

    expect(litIds(container, 'on')).toEqual(['curve']);
    expect(litIds(container, 'off')).toHaveLength(ROLES.length - 1);
  });

  it('leaves a resting pointer alone with a touch screen, no fine pointer or reduced motion', async () => {
    restOn('curve');

    stubMedia(true);
    vi.stubGlobal('navigator', Object.create(navigator, { maxTouchPoints: { value: 1 } }));
    const touch = render(await ExperiencePage());
    expect(anyLit(touch.container)).toBe(0);
    touch.unmount();
    vi.unstubAllGlobals();

    stubMedia(false);
    const coarse = render(await ExperiencePage());
    expect(anyLit(coarse.container)).toBe(0);
    coarse.unmount();

    stubMedia(true, true);
    const reduced = render(await ExperiencePage());
    expect(anyLit(reduced.container)).toBe(0);
  });

  it('adds no element of its own beyond one hidden marker', async () => {
    const { container } = render(await ExperiencePage());
    const marker = container.querySelector('[data-role-crosslight]');

    expect(marker).toHaveAttribute('hidden');
    expect(marker?.childElementCount).toBe(0);
  });
});
