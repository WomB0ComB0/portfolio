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
 * @file The desktop rail opens one group's flyout at a time, and Escape or a click outside closes
 * it. Each trigger reports its state and names the panel it controls. A flyout also follows
 * keyboard focus: it closes when focus leaves its group (trigger and panel), as in the WAI-ARIA
 * disclosure navigation pattern, and its Escape never pulls focus out of the page.
 */

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { KBarProvider } from 'kbar';
import { describe, expect, it, vi } from 'vitest';

import { NavBar } from '@/components/layout/nav';

// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});

/** The rail beside some page content and a page field. */
const renderRail = (path = '/') =>
  render(
    <KBarProvider>
      <p>Page content</p>
      <NavBar path={path} />
      <label>
        Message
        <input />
      </label>
    </KBarProvider>,
  );

const trigger = (label: string) => screen.getByRole('button', { name: `${label} section` });

const expanded = (label: string) => trigger(label).getAttribute('aria-expanded');

const pageField = () => screen.getByRole('textbox', { name: 'Message' });

/** The panel a trigger controls, found through its aria-controls. */
const panelOf = (label: string): HTMLElement => {
  const id = trigger(label).getAttribute('aria-controls');
  if (!id) throw new Error(`${label} trigger has no aria-controls`);
  const panel = document.getElementById(id);
  if (!panel) throw new Error(`${label} panel #${id} is not rendered`);
  return panel;
};

const expectClosed = async (label: string) => {
  expect(expanded(label)).toBe('false');
  await waitFor(() => {
    const id = trigger(label).getAttribute('aria-controls');
    expect(id && document.getElementById(id)).toBeFalsy();
  });
};

/** Moves focus as Tab or a script would, letting React apply the resulting state. */
const focus = (element: HTMLElement) => act(() => element.focus());

/** Opens a group from the keyboard and moves focus to its first link. */
const openAndFocusFirstLink = (label: string): HTMLElement => {
  focus(trigger(label));
  fireEvent.click(trigger(label));
  const [first] = within(panelOf(label)).getAllByRole('link');
  if (!first) throw new Error(`${label} panel has no links`);
  focus(first);
  return first;
};

describe('NavBar flyouts', () => {
  it('names the panel each trigger controls, and starts with every group closed', () => {
    renderRail();

    for (const label of ['Professional', 'Developer', 'Personal', 'Legal']) {
      expect(expanded(label)).toBe('false');
      expect(trigger(label)).toHaveAttribute('aria-controls');
    }

    fireEvent.click(trigger('Personal'));

    expect(expanded('Personal')).toBe('true');
    const panel = panelOf('Personal');
    for (const name of ['Places', 'Spotify', 'Guestbook']) {
      expect(within(panel).getByRole('link', { name })).toBeInTheDocument();
    }
  });

  it('closes the open group when another one opens', async () => {
    renderRail();

    fireEvent.pointerDown(trigger('Professional'));
    fireEvent.click(trigger('Professional'));
    fireEvent.pointerDown(trigger('Developer'));
    fireEvent.click(trigger('Developer'));

    expect(expanded('Developer')).toBe('true');
    await expectClosed('Professional');
    expect(within(panelOf('Developer')).getByRole('link', { name: 'Stats' })).toBeInTheDocument();
  });

  it('keeps one group open when switching by keyboard, without any pointer events', async () => {
    renderRail();

    fireEvent.click(trigger('Professional'));
    fireEvent.click(trigger('Legal'));

    expect(expanded('Legal')).toBe('true');
    await expectClosed('Professional');
  });

  it('closes on a click outside the rail', async () => {
    renderRail();
    fireEvent.click(trigger('Legal'));

    fireEvent.pointerDown(screen.getByText('Page content'));

    await expectClosed('Legal');
  });

  it('stays open for a click inside its own panel', () => {
    renderRail();
    fireEvent.click(trigger('Legal'));

    fireEvent.pointerDown(panelOf('Legal'));

    expect(expanded('Legal')).toBe('true');
  });

  it('toggles closed when its own trigger is clicked again', async () => {
    renderRail();
    fireEvent.click(trigger('Professional'));

    fireEvent.pointerDown(trigger('Professional'));
    fireEvent.click(trigger('Professional'));

    await expectClosed('Professional');
  });

  it('closes when the command palette opens over it with Ctrl+K', async () => {
    renderRail();
    fireEvent.click(trigger('Personal'));

    act(() => {
      fireEvent.keyDown(document.body, { key: 'k', code: 'KeyK', ctrlKey: true });
    });

    await expectClosed('Personal');
  });

  it('marks the current page in the open flyout', () => {
    renderRail('/resume');
    fireEvent.click(trigger('Professional'));

    expect(within(panelOf('Professional')).getByRole('link', { name: 'Resume' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});

describe('NavBar flyouts and keyboard focus', () => {
  it('stays open while focus moves between its trigger and its links', () => {
    renderRail();
    const first = openAndFocusFirstLink('Professional');

    focus(trigger('Professional'));
    focus(first);

    expect(expanded('Professional')).toBe('true');
  });

  it('closes when Tab moves focus on to the next rail button', async () => {
    renderRail();
    openAndFocusFirstLink('Professional');

    focus(trigger('Developer'));

    await expectClosed('Professional');
    expect(trigger('Developer')).toHaveFocus();
  });

  it('closes when focus leaves the rail for the page', async () => {
    renderRail();
    openAndFocusFirstLink('Personal');

    focus(pageField());

    await expectClosed('Personal');
    expect(pageField()).toHaveFocus();
  });

  // Focus going nowhere (relatedTarget null) is a click on the panel's own text or a switch to
  // another window; the pointerdown handler already deals with clicks outside.
  it('stays open when focus leaves to nothing, as on a click on the panel label', () => {
    renderRail();
    const first = openAndFocusFirstLink('Legal');

    act(() => first.blur());

    expect(expanded('Legal')).toBe('true');
  });

  it('closes on Escape from a page field without taking focus from it', async () => {
    renderRail();
    fireEvent.click(trigger('Developer'));
    // Focus reached the field without leaving the group by keyboard (opened by mouse in Safari,
    // or moved there by a script).
    focus(pageField());

    fireEvent.keyDown(pageField(), { key: 'Escape' });

    await expectClosed('Developer');
    expect(pageField()).toHaveFocus();
  });

  it('closes on Escape from one of its links and returns focus to the trigger', async () => {
    renderRail();
    const first = openAndFocusFirstLink('Developer');

    fireEvent.keyDown(first, { key: 'Escape' });

    await expectClosed('Developer');
    expect(trigger('Developer')).toHaveFocus();
  });
});
