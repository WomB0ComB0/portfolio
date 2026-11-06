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
import React, {
  type JSX,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  createNavigationActions,
  findNavigationShortcut,
  NAVIGATION_SHORTCUTS,
} from '@/lib/navigation/actions';
import { cn } from '@/lib/utils';

/**
 * Accessible name of the palette's search box. The phone bar's Search button, which opens the
 * palette, has the same name.
 */
export const PALETTE_SEARCH_LABEL = 'Search pages and commands';

/** The shortcut letter of each page action, by action id. */
const SHORTCUT_KEYS: ReadonlyMap<ActionId, string> = new Map(
  NAVIGATION_SHORTCUTS.map(({ id, key }) => [id, key]),
);

/** The platforms kbar (tinykeys) binds its `$mod` to Meta (⌘) on; everywhere else it is Ctrl. */
const APPLE_PLATFORM = /Mac|iPhone|iPad|iPod/;

const isApplePlatform = (): boolean =>
  typeof navigator !== 'undefined' && APPLE_PLATFORM.test(navigator.platform);

/** How the shortcut modifier is printed on this keyboard: Option on Apple devices, else Alt. */
const modifierLabel = (): string => (isApplePlatform() ? '⌥' : 'Alt');

/** The key combination that opens the palette (kbar's default `$mod+k`). */
export interface PaletteShortcut {
  /** As a hint prints it: ⌘K on Apple devices, Ctrl K elsewhere. */
  readonly label: string;
  /** The aria-keyshortcuts value: Meta+K or Control+K. */
  readonly keys: string;
}

const APPLE_SHORTCUT: PaletteShortcut = { label: '⌘K', keys: 'Meta+K' };
const OTHER_SHORTCUT: PaletteShortcut = { label: 'Ctrl K', keys: 'Control+K' };

const browserShortcut = (): PaletteShortcut =>
  isApplePlatform() ? APPLE_SHORTCUT : OTHER_SHORTCUT;
const serverShortcut = (): PaletteShortcut => APPLE_SHORTCUT;
/** The platform never changes during a visit, so there is nothing to subscribe to. */
const subscribeToNothing = (): (() => void) => () => {};

/**
 * The palette shortcut as this keyboard prints it. Server HTML and hydration show ⌘K (the server
 * cannot know the platform); other platforms switch to Ctrl K right after hydrating.
 */
export const usePaletteShortcut = (): PaletteShortcut =>
  useSyncExternalStore(subscribeToNothing, browserShortcut, serverShortcut);

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

/** kbar's own cap on the results list. The list keeps it wherever the viewport has the room. */
export const RESULTS_MAX_HEIGHT = 400;

/** Two 42 px rows: the list never shrinks below this, so a very short viewport still shows some. */
export const RESULTS_MIN_HEIGHT = 84;

/** The gap kept between the panel's bottom and the visual viewport's (the keyboard's top edge). */
const VIEWPORT_BOTTOM_GAP = 16;

/** Where the results list sits against the visible part of the screen, in client pixels. */
export interface ResultsFit {
  /** The visual viewport's bottom edge: its offsetTop plus its height. */
  readonly viewportBottom: number;
  /** The results list's top edge. */
  readonly listTop: number;
  /** What the panel draws under the list: the wrapper's padding, the key hints and the border. */
  readonly belowList: number;
}

/**
 * The results list's max height that keeps the whole panel above the visual viewport's bottom,
 * within kbar's 400 px cap and the two-row floor.
 */
export const fitResultsHeight = ({ viewportBottom, listTop, belowList }: ResultsFit): number => {
  const room = Math.floor(viewportBottom - listTop - belowList - VIEWPORT_BOTTOM_GAP);
  return Math.min(RESULTS_MAX_HEIGHT, Math.max(RESULTS_MIN_HEIGHT, room));
};

/** Measures the results list (the wrapper's first child, kbar's scroll box) against `viewport`. */
const measureResults = (viewport: VisualViewport, wrapper: HTMLElement): number => {
  const list = (wrapper.firstElementChild ?? wrapper).getBoundingClientRect();
  // The wrapper's parent is KBarAnimator's inner box, which is never clipped by its height animation.
  const panelBottom = (wrapper.parentElement ?? wrapper).getBoundingClientRect().bottom;
  return fitResultsHeight({
    viewportBottom: viewport.offsetTop + viewport.height,
    listTop: list.top,
    belowList: panelBottom - list.bottom,
  });
};

/**
 * The results list's max height. On a phone the search box autofocuses, so the on-screen keyboard
 * opens with the palette. The site sets interactive-widget=resizes-visual, so only the visual
 * viewport shrinks for it (dvh and the fixed positioner do not), and kbar's fixed 400 px list ran
 * under the keyboard. This caps the list to the room above the visual viewport's bottom edge and
 * follows the keyboard as it opens, closes or pans. Where visualViewport is missing it stays 400,
 * and a desktop window with the room for 400 px keeps exactly that.
 */
const useResultsMaxHeight = (wrapperRef: RefObject<HTMLElement | null>): number => {
  const [maxHeight, setMaxHeight] = useState(RESULTS_MAX_HEIGHT);

  useEffect(() => {
    const viewport = window.visualViewport;
    const wrapper = wrapperRef.current;
    if (!viewport || !wrapper) return;
    const update = () => setMaxHeight(measureResults(viewport, wrapper));
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, [wrapperRef]);

  return maxHeight;
};

/**
 * kbar sets the positioner's padding inline (14vh 16px 16px), which only an important utility can
 * beat. On touch screens the keyboard opens with the palette, so the panel moves up to just under
 * the top safe-area inset and leaves the keyboard's share of the screen to the results. Fine
 * pointers (desktop) keep kbar's 14vh.
 */
const POSITIONER_CLASS =
  'z-50 overflow-hidden bg-canvas/70 backdrop-blur-sm select-none pointer-coarse:pt-[calc(0.75rem+env(safe-area-inset-top))]!';

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
      <KBarPositioner className={POSITIONER_CLASS}>
        <KBarAnimator className="w-full max-w-[40rem] overflow-hidden rounded-tile border border-hairline bg-surface-2 text-foreground shadow-raised focus-within:border-hairline-strong">
          <KBarSearch
            aria-label={PALETTE_SEARCH_LABEL}
            className="w-full border-b border-hairline bg-transparent px-5 py-4 text-body text-foreground outline-none placeholder:text-faint"
            placeholder="Type a command or search..."
          />
          <RenderResults />
          <PaletteKeyHints />
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
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const maxHeight = useResultsMaxHeight(wrapperRef);

  return (
    <div ref={wrapperRef} className="py-1.5">
      <KBarResults
        items={results}
        maxHeight={maxHeight}
        onRender={({ item, active }) =>
          typeof item === 'string' ? (
            <div className="label-mono px-5 pt-3 pb-1 text-faint" key={item}>
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
    </div>
  );
}

/**
 * The palette's keys, under the results. Keyboard help only: hidden on touch screens, and from
 * assistive tech, which announces the combobox and its options itself.
 */
const PaletteKeyHints = (): JSX.Element => (
  <div
    aria-hidden="true"
    className="flex gap-4 border-t border-hairline px-5 py-2 font-mono text-label text-faint pointer-coarse:hidden"
  >
    <span>↑↓ navigate</span>
    <span>↵ open</span>
    <span>esc close</span>
  </div>
);

/** The Alt+letter hint shown beside a page action. */
const ShortcutHint = ({ letter }: { readonly letter: string }): JSX.Element => (
  <div className="flex shrink-0 items-center gap-1">
    {[modifierLabel(), letter.toUpperCase()].map((label) => (
      <kbd
        key={label}
        className="rounded border border-hairline bg-surface-3 px-1.5 py-0.5 font-mono text-label text-muted-foreground"
      >
        {label}
      </kbd>
    ))}
  </div>
);

/** Every result row: inset from the panel edge so the active fill reads as a selection. */
const RESULT_ROW =
  'relative mx-2 flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2.5 text-body-sm transition-colors duration-(--motion-instant) ease-standard';

/** The row the arrow keys or the pointer are on: a raised fill and a 2 px brand bar. */
const RESULT_ROW_ACTIVE =
  'bg-surface-3 text-foreground before:absolute before:top-2 before:bottom-2 before:left-0 before:w-0.5 before:rounded-full before:bg-brand';

const RESULT_ROW_IDLE = 'text-muted-foreground';

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
      <div ref={ref} className={cn(RESULT_ROW, active ? RESULT_ROW_ACTIVE : RESULT_ROW_IDLE)}>
        <div className="flex min-w-0 items-center gap-3">
          <span className={cn('flex shrink-0', active ? 'text-brand-ink' : 'text-faint')}>
            {action.icon}
          </span>
          <div className="flex min-w-0 flex-col">
            <div className="flex items-center gap-2">
              {ancestors.length > 0 &&
                ancestors.map((ancestor) => (
                  <React.Fragment key={ancestor.id}>
                    <span className="text-faint">{ancestor.name}</span>
                    <span className="text-faint">&rsaquo;</span>
                  </React.Fragment>
                ))}
              <span>{action.name}</span>
            </div>
            {action.subtitle && <span className="text-label text-faint">{action.subtitle}</span>}
          </div>
        </div>
        {shortcutKey ? <ShortcutHint letter={shortcutKey} /> : null}
      </div>
    );
  },
);
ResultItem.displayName = 'ResultItem';
