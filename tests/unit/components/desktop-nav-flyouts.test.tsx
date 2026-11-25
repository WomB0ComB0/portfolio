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
 *
 * Every flyout stays in the HTML, open or closed, so each page's server HTML links every nav
 * destination with a plain `<a href>`. jsdom applies no Tailwind CSS, so "closed" is the class
 * and attribute contract: `invisible` (visibility: hidden) and `inert`, which keep a closed
 * flyout's links out of the tab order and the accessibility tree.
 */

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { KBarProvider, useKBar, VisualState } from 'kbar';
import { describe, expect, it, vi } from 'vitest';

import { NavBar } from '@/components/layout/nav';

// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});

/** The real provider's settled state, including its asynchronous animation timer. */
function PaletteState() {
  const { visualState } = useKBar((state) => ({ visualState: state.visualState }));
  return <output data-testid="palette-state">{visualState}</output>;
}

/** KBar does not cancel its animation timer on unmount; let it settle while still mounted. */
const expectPaletteState = async (state: VisualState): Promise<void> => {
  await waitFor(() => expect(screen.getByTestId('palette-state')).toHaveTextContent(state));
};

/** The rail beside some page content and a page field. */
const rail = (path: string) => (
  <KBarProvider>
    <PaletteState />
    <p>Page content</p>
    <NavBar path={path} />
    <label>
      Message
      <input />
    </label>
  </KBarProvider>
);

const renderRail = (path = '/') => render(rail(path));

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

const classesOf = (element: Element): string[] =>
  (element.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);

/** A closed flyout is still in the document, hidden from sight, focus and assistive tech. */
const expectClosed = async (label: string) => {
  expect(expanded(label)).toBe('false');
  await waitFor(() => {
    const panel = panelOf(label);
    expect(panel).toHaveAttribute('inert');
    expect(classesOf(panel)).toEqual(expect.arrayContaining(['invisible', 'opacity-0']));
    expect(classesOf(panel)).not.toContain('visible');
  });
};

const expectOpen = (label: string) => {
  expect(expanded(label)).toBe('true');
  const panel = panelOf(label);
  expect(panel).not.toHaveAttribute('inert');
  expect(classesOf(panel)).toEqual(expect.arrayContaining(['visible', 'opacity-100']));
  expect(classesOf(panel)).not.toContain('invisible');
};

const GROUP_LABELS = ['Professional', 'Developer', 'Personal', 'Legal'] as const;

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
  it('names the panel each trigger controls, and starts with every group closed', async () => {
    renderRail();

    for (const label of GROUP_LABELS) {
      expect(trigger(label)).toHaveAttribute('aria-controls');
      await expectClosed(label);
    }

    fireEvent.click(trigger('Personal'));

    expectOpen('Personal');
    const panel = panelOf('Personal');
    for (const name of ['Places', 'Spotify', 'Guestbook', 'Bookshelf']) {
      expect(within(panel).getByRole('link', { name })).toBeInTheDocument();
    }
  });

  it('closes the open group when another one opens', async () => {
    renderRail();

    fireEvent.pointerDown(trigger('Professional'));
    fireEvent.click(trigger('Professional'));
    fireEvent.pointerDown(trigger('Developer'));
    fireEvent.click(trigger('Developer'));

    expectOpen('Developer');
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

  it('closes when the route changes some other way, such as Back, since the shell stays mounted', async () => {
    const { rerender } = renderRail('/projects');
    fireEvent.click(trigger('Personal'));
    expect(expanded('Personal')).toBe('true');

    rerender(rail('/places'));

    await expectClosed('Personal');
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
    await expectPaletteState(VisualState.showing);
  });

  it('marks the current page in the open flyout', () => {
    renderRail('/resume');
    fireEvent.click(trigger('Professional'));

    expect(within(panelOf('Professional')).getByRole('link', { name: 'Resume' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  // The trigger is all a closed flyout leaves in the accessibility tree, and the rail marks it
  // for sight (fill and brand bar) whenever the page is in its group: assistive tech hears it too.
  it("marks the current page's group on its trigger for assistive tech, and no other trigger", () => {
    renderRail('/resume');

    expect(trigger('Professional')).toHaveAttribute('aria-current', 'true');
    for (const label of GROUP_LABELS.filter((name) => name !== 'Professional')) {
      expect(trigger(label)).not.toHaveAttribute('aria-current');
    }
  });

  it('marks the section on a detail page: its trigger, and its link as the section in brand-ink', () => {
    renderRail('/projects/some-id');
    fireEvent.click(trigger('Professional'));
    const panel = panelOf('Professional');
    const section = within(panel).getByRole('link', { name: 'Projects' });

    expect(trigger('Professional')).toHaveAttribute('aria-current', 'true');
    expect(section).toHaveAttribute('aria-current', 'true');
    expect(section).toHaveClass('text-brand-ink');
    expect(within(panel).queryByRole('link', { current: 'page' })).toBeNull();
    expect(within(panel).getByRole('link', { name: 'Resume' })).not.toHaveAttribute('aria-current');
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
    await expectPaletteState(VisualState.hidden);
  });

  it('closes on Escape from one of its links and returns focus to the trigger', async () => {
    renderRail();
    const first = openAndFocusFirstLink('Developer');

    fireEvent.keyDown(first, { key: 'Escape' });

    await expectClosed('Developer');
    expect(trigger('Developer')).toHaveFocus();
    await expectPaletteState(VisualState.hidden);
  });
});

describe('NavBar *.mikeodnis.dev ecosystem switcher', () => {
  const networkTrigger = () => screen.getByRole('button', { name: '*.mikeodnis.dev network' });

  it('starts closed without dangling aria-controls, and opens with Portfolio marked here plus Ventures', () => {
    renderRail('/');

    expect(networkTrigger()).toHaveAttribute('aria-expanded', 'false');
    expect(networkTrigger()).not.toHaveAttribute('aria-controls');
    expect(document.getElementById('nav-flyout-ecosystem')).toBeNull();

    fireEvent.click(networkTrigger());

    expect(networkTrigger()).toHaveAttribute('aria-expanded', 'true');
    expect(networkTrigger()).toHaveAttribute('aria-controls', 'nav-flyout-ecosystem');

    const panel = document.getElementById('nav-flyout-ecosystem');
    if (!panel) throw new Error('Ecosystem flyout is not rendered');
    const networkList = within(panel).getByRole('list', { name: '*.mikeodnis.dev' });
    const portfolio = within(networkList).getByRole('link', { name: /Portfolio/ });
    expect(portfolio).toHaveTextContent('here');
    expect(portfolio).toHaveClass('bg-brand-subtle', 'text-brand-ink');

    const links = within(networkList).getByRole('link', { name: 'Links' });
    expect(links).toHaveAttribute('href', 'https://links.mikeodnis.dev');
    expect(links).toHaveAttribute('target', '_blank');
    expect(links).toHaveAttribute('rel', 'noopener noreferrer');

    const venturesList = within(panel).getByRole('list', { name: 'Ventures' });
    expect(within(venturesList).getByRole('link', { name: 'Elysium Tools' })).toHaveAttribute(
      'href',
      'https://elysium.tools',
    );
    expect(within(venturesList).getByRole('link', { name: 'Atroviola' })).toHaveAttribute(
      'href',
      'https://atroviola.com',
    );
  });

  it('coordinates with page-group flyouts and closes on Escape', async () => {
    renderRail('/');

    fireEvent.click(trigger('Professional'));
    expectOpen('Professional');

    fireEvent.click(networkTrigger());
    await expectClosed('Professional');
    expect(networkTrigger()).toHaveAttribute('aria-expanded', 'true');

    const panel = document.getElementById('nav-flyout-ecosystem');
    if (!panel) throw new Error('Ecosystem flyout is not rendered');
    const linksAnchor = within(panel).getByRole('link', { name: 'Links' });
    focus(linksAnchor);
    fireEvent.keyDown(linksAnchor, { key: 'Escape' });

    expect(networkTrigger()).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById('nav-flyout-ecosystem')).toBeNull();
    expect(networkTrigger()).toHaveFocus();
  });
});
