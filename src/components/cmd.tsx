'use client';

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

import {
  type ActionId,
  type ActionImpl,
  KBarAnimator,
  KBarPortal,
  KBarPositioner,
  KBarResults,
  KBarSearch,
  useKBar,
  useMatches,
  useRegisterActions,
  VisualState,
} from 'kbar';
import { useRouter } from 'next/navigation';
import React, { type JSX, useEffect, useMemo } from 'react';
import {
  createNavigationActions,
  findNavigationShortcut,
  NAVIGATION_SHORTCUTS,
} from '@/lib/navigation/actions';

/** Accessible name of the palette's search box. */
const SEARCH_LABEL = 'Search pages and commands';

/** The shortcut letter of each page action, by action id. */
const SHORTCUT_KEYS: ReadonlyMap<ActionId, string> = new Map(
  NAVIGATION_SHORTCUTS.map(({ id, key }) => [id, key]),
);

const APPLE_PLATFORM = /Mac|iPhone|iPad|iPod/;

/** How the shortcut modifier is printed on this keyboard: Option on Apple devices, else Alt. */
const modifierLabel = (): string =>
  typeof navigator !== 'undefined' && APPLE_PLATFORM.test(navigator.platform) ? '⌥' : 'Alt';

const isPaletteOpen = (visualState: VisualState): boolean =>
  visualState === VisualState.animatingIn || visualState === VisualState.showing;

/**
 * Registers the page actions with the App Router, so choosing one is a client-side navigation
 * rather than a full reload.
 */
const useNavigationActions = (navigate: (href: string) => void): void => {
  const navigationActions = useMemo(() => createNavigationActions(navigate), [navigate]);
  useRegisterActions(navigationActions, [navigationActions]);
};

/**
 * Alt+letter (Option+letter) jumps to a page, but only while the palette is open. Nothing is bound
 * page-wide, and bare letters stay with the search box (WCAG 2.1.4). So does an Option+letter that
 * types a character on the viewer's layout, such as 'ł' on a Polish Mac (see findNavigationShortcut).
 */
const usePaletteShortcuts = (navigate: (href: string) => void): void => {
  const { query, open } = useKBar((state) => ({ open: isPaletteOpen(state.visualState) }));

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const shortcut = findNavigationShortcut(event);
      if (!shortcut) return;
      event.preventDefault();
      query.toggle();
      navigate(shortcut.href);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, query, navigate]);
};

/**
 * @function Palette
 * @public
 * @description Renders the command palette modal interface using KBar components, and registers
 * the page actions and their in-palette shortcuts. ⌘K / Ctrl+K opens it.
 * @returns {JSX.Element} A React element rendering the palette modal and search results.
 * @author Mike Odnis
 * @web
 * @see https://github.com/WomB0ComB0/portfolio
 * @version 2.0.0
 * @example
 *   <Palette />
 */
export const Palette = (): JSX.Element => {
  const router = useRouter();
  const navigate = React.useCallback((href: string) => router.push(href), [router]);
  useNavigationActions(navigate);
  usePaletteShortcuts(navigate);

  return (
    <KBarPortal>
      <KBarPositioner className="z-50 select-none backdrop-blur bg-background/80 font-clash overflow-hidden">
        <KBarAnimator className="w-[90%] max-w-[600px] overflow-hidden text-lg bg-background text-foreground rounded-lg shadow-2xl kbar">
          <KBarSearch
            aria-label={SEARCH_LABEL}
            className="w-full p-4 text-base bg-background text-foreground border-b border-accent/30 outline-none placeholder-foreground/50 focus:ring-2 focus:ring-accent"
            placeholder="Type a command or search..."
          />
          <RenderResults />
        </KBarAnimator>
      </KBarPositioner>
    </KBarPortal>
  );
};
Palette.displayName = 'Palette';
export default Palette;

/**
 * @function RenderResults
 * @private
 * @description Renders the results section in the command palette. Maps each result to either a section header or a ResultItem component, coordinating ancestor context for each action.
 * @returns {JSX.Element} A React fragment rendering all matched command results or section headers.
 * @author Mike Odnis
 * @see https://kbar.vercel.app/docs/usage
 * @version 1.0.0
 */
function RenderResults(): JSX.Element {
  const { results, rootActionId } = useMatches();

  return (
    <KBarResults
      items={results}
      onRender={({ item, active }) =>
        typeof item === 'string' ? (
          <div className="px-4 py-2 text-xs text-foreground/70 uppercase" key={item}>
            {item}
          </div>
        ) : (
          <ResultItem
            key={item.id}
            action={item}
            active={active}
            currentRootActionId={rootActionId}
          />
        )
      }
    />
  );
}

/** The Alt+letter hint shown beside a page action. */
const ShortcutHint = ({ letter }: { readonly letter: string }): JSX.Element => (
  <div className="flex items-center">
    {[modifierLabel(), letter.toUpperCase()].map((label) => (
      <kbd key={label} className="px-2 py-1 ml-2 text-xs bg-accent/30 text-foreground rounded">
        {label}
      </kbd>
    ))}
  </div>
);

/**
 * @readonly
 * @public
 * @description
 * Displays an individual action within the KBar results, supporting nested actions (ancestors), the action's own icon, and its in-palette shortcut hint.
 * @param {object} props The properties object.
 * @param {ActionImpl} props.action The action entry details to render.
 * @param {boolean} props.active Whether this result is the currently selected/active result.
 * @param {ActionId} props.currentRootActionId The root action context for ancestor calculation.
 * @param {React.Ref<HTMLDivElement>} ref Reference to the container div element, set by KBar for keyboard navigation.
 * @returns {JSX.Element} The rendered action result entry.
 * @author Mike Odnis
 * @web
 * @see https://kbar.vercel.app/docs/components/results
 * @version 2.0.0
 * @example
 *   <ResultItem action={action} active={isActive} currentRootActionId={rootId} ref={ref} />
 */
export const ResultItem = React.forwardRef(
  (
    {
      action,
      active,
      currentRootActionId,
    }: {
      action: ActionImpl;
      active: boolean;
      currentRootActionId?: ActionId | null;
    },
    ref: React.Ref<HTMLDivElement>,
  ): JSX.Element => {
    /**
     * @description
     * Computes the ancestors for the displayed action, omitting any that are present in the current root action context.
     * @type {ActionImpl['ancestors']}
     */
    const ancestors = React.useMemo(() => {
      if (!currentRootActionId) return action.ancestors;
      const index = action.ancestors.findIndex((ancestor) => ancestor.id === currentRootActionId);
      return action.ancestors.slice(index + 1);
    }, [action.ancestors, currentRootActionId]);

    const shortcutKey = SHORTCUT_KEYS.get(action.id);

    return (
      <div
        ref={ref}
        className={`px-4 py-2 flex items-center justify-between cursor-pointer transition-all ${
          active ? 'bg-accent text-foreground' : 'text-foreground hover:bg-accent/20'
        }`}
      >
        <div className="flex items-center gap-3">
          {action.icon}
          <div className="flex flex-col">
            <div className="flex items-center gap-2 text-sm">
              {ancestors.length > 0 &&
                ancestors.map((ancestor) => (
                  <React.Fragment key={ancestor.id}>
                    <span className="text-foreground/70">{ancestor.name}</span>
                    <span className="text-foreground/50">&rsaquo;</span>
                  </React.Fragment>
                ))}
              <span>{action.name}</span>
            </div>
            {action.subtitle && (
              <span className="text-xs text-foreground/50">{action.subtitle}</span>
            )}
          </div>
        </div>
        {shortcutKey ? <ShortcutHint letter={shortcutKey} /> : null}
      </div>
    );
  },
);
ResultItem.displayName = 'ResultItem';
