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
  getListboxItemId,
  KBarAnimator,
  KBarPortal,
  KBarPositioner,
  type KBarQuery,
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
  useLayoutEffect,
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
 * palette, has the same name, with the shortcut after it wherever its hint shows (withShortcut).
 */
export const PALETTE_SEARCH_LABEL = 'Search pages and commands';

/**
 * Accessible name of the palette's dialog. The rail button that opens it shows the same words in
 * its tooltip, and its name starts with them (withShortcut).
 */
export const PALETTE_DIALOG_LABEL = 'Command menu';

/** The line shown, and announced politely, when nothing matches the search. */
export const NO_RESULTS_TEXT = 'No results';

/** Accessible name of the results scroller, the palette's second Tab stop. */
export const RESULTS_REGION_LABEL = 'Search results';

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

/**
 * A button's name with the shortcut its hint shows after it: 'Command menu, ⌘K'. The hint is text
 * inside the button, so its name says it too (WCAG 2.5.3, Label in Name: a voice user can say
 * what they see). After a comma, not in brackets: a checker drops a bracketed part before it
 * compares.
 *
 * @example
 * withShortcut('Search pages and commands', { label: 'Ctrl K', keys: 'Control+K' })
 * // 'Search pages and commands, Ctrl K'
 */
export const withShortcut = (name: string, shortcut: PaletteShortcut): string =>
  `${name}, ${shortcut.label}`;

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
const useResultsMaxHeight = (wrapperRef: RefObject<HTMLElement | null>, empty: boolean): number => {
  const [maxHeight, setMaxHeight] = useState(RESULTS_MAX_HEIGHT);

  useEffect(() => {
    const viewport = window.visualViewport;
    const wrapper = wrapperRef.current;
    // With no results the list is hidden (useResultsRegion) and has no box to measure; it is
    // measured again the moment results come back.
    if (!viewport || !wrapper || empty) return;
    const update = () => setMaxHeight(measureResults(viewport, wrapper));
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, [wrapperRef, empty]);

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
 * KBarPositioner as it is at runtime: kbar forwards its ref and spreads every other prop onto its
 * div (node_modules/kbar/lib/KBarPositioner.js), though its types admit only className and style.
 * It is the one element kbar lets the palette name, so it carries the dialog role.
 */
const Positioner = KBarPositioner as unknown as React.ForwardRefExoticComponent<
  React.ComponentPropsWithoutRef<'div'> & React.RefAttributes<HTMLDivElement>
>;

/** kbar's search box, or null before it mounts (kbar's own getInput throws then). */
const searchBoxOf = (query: KBarQuery): HTMLInputElement | null => {
  try {
    return query.getInput();
  } catch {
    return null;
  }
};

/**
 * Makes the page behind the palette inert while it is open: every child of <body> but the one
 * holding the palette (kbar portals it into <body>), leaving any that were inert already as they
 * were. The page comes back in a layout effect, so it is live again before kbar returns focus to
 * the control that opened the palette (a passive effect of the same commit): focus cannot land on
 * an inert element.
 */
const useInertPage = (paletteRef: RefObject<HTMLElement | null>, open: boolean): void => {
  useLayoutEffect(() => {
    const palette = paletteRef.current;
    if (!open || !palette) return;
    const madeInert = Array.from(document.body.children).filter(
      (child) => !child.contains(palette) && !child.hasAttribute('inert'),
    );
    for (const child of madeInert) child.setAttribute('inert', '');
    return () => {
      for (const child of madeInert) child.removeAttribute('inert');
    };
  }, [open, paletteRef]);
};

/**
 * The palette's Tab stops in order: the search box, then the results region while it is shown
 * (useResultsRegion hides it while nothing matches). Nothing else in the palette takes focus.
 */
/** Keys that only change what the next key does. */
const MODIFIER_KEYS: ReadonlySet<string> = new Set(['Shift', 'Control', 'Alt', 'Meta']);

const tabStopsIn = (dialog: HTMLElement): HTMLElement[] =>
  Array.from(dialog.querySelectorAll<HTMLElement>('input, [tabindex="0"]')).filter(
    (stop) => !stop.closest('[hidden]'),
  );

/**
 * Tab and Shift+Tab cycle through the palette's Tab stops while it is open, the search box and the
 * results region, and never leave it: the page behind is inert, and with nothing after the palette
 * Tab would go on to the browser's own controls. Focus on nothing in the palette (after a press on
 * its padding) goes to the search box. kbar already brings focus back to the search box on any
 * other key pressed elsewhere in the palette (its useFocusHandler); this covers Tab, whose default
 * action would otherwise run after kbar's listener and move on.
 */
const useTabWithinPalette = (
  dialogRef: RefObject<HTMLElement | null>,
  query: KBarQuery,
  open: boolean,
): void => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (MODIFIER_KEYS.has(event.key)) {
        // kbar's listener also sends focus to the search box on a modifier pressed on its own, which
        // a keyboard sends before Shift+Tab: from the results, Shift+Tab would then start at the
        // search box and wrap straight back. A lone modifier does nothing else, so kbar never sees it.
        const focused = document.activeElement;
        if (focused !== searchBoxOf(query) && dialogRef.current?.contains(focused)) {
          event.stopPropagation();
        }
        return;
      }
      if (event.key !== 'Tab' || event.isComposing) return;
      event.preventDefault();
      const stops = dialogRef.current ? tabStopsIn(dialogRef.current) : [];
      const focused = document.activeElement;
      const at = focused instanceof HTMLElement ? stops.indexOf(focused) : -1;
      const step = event.shiftKey ? -1 : 1;
      const next =
        at === -1 ? searchBoxOf(query) : stops[(at + step + stops.length) % stops.length];
      next?.focus();
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [dialogRef, open, query]);
};

/**
 * The palette as a modal dialog: named, marked modal, the page behind it inert and Tab kept within
 * it while it is open. kbar draws the overlay but none of that. It mounts with each opening
 * (KBarPortal renders nothing while the palette is hidden).
 */
const PaletteDialog = (): JSX.Element => {
  const positionerRef = useRef<HTMLDivElement | null>(null);
  const { query, open } = useKBar((state) => ({ open: isPaletteOpen(state.visualState) }));
  useInertPage(positionerRef, open);
  useTabWithinPalette(positionerRef, query, open);

  return (
    <Positioner
      ref={positionerRef}
      role="dialog"
      aria-modal="true"
      aria-label={PALETTE_DIALOG_LABEL}
      className={POSITIONER_CLASS}
    >
      <KBarAnimator className="w-full max-w-[40rem] overflow-hidden rounded-tile border border-hairline bg-surface-2 text-foreground shadow-raised focus-within:border-hairline-strong">
        <KBarSearch
          aria-label={PALETTE_SEARCH_LABEL}
          className="w-full border-b border-hairline bg-transparent px-5 py-4 text-body text-foreground outline-none placeholder:text-faint"
          placeholder="Type a command or search..."
        />
        <RenderResults />
        <PaletteKeyHints />
      </KBarAnimator>
    </Positioner>
  );
};

/**
 * @function Palette
 * @public
 * @description Renders the command palette modal interface using KBar components, and registers
 * the page actions and their in-palette shortcuts. ⌘K / Ctrl+K opens it. While open it is a modal
 * dialog named "Command menu", with the rest of the page inert behind it.
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
      <PaletteDialog />
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
  const { query, activeIndex, showing } = useKBar((state) => ({
    activeIndex: state.activeIndex,
    showing: state.visualState === VisualState.showing,
  }));
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const empty = results.length === 0;
  const maxHeight = useResultsMaxHeight(wrapperRef, empty);
  const activeItem = results[activeIndex];
  useResultsRegion(wrapperRef, empty);
  useExpandedOnlyWithResults(query, showing, empty);
  useActiveDescendantOnlyOnARenderedOption(
    query,
    wrapperRef,
    activeItem !== undefined && typeof activeItem !== 'string',
    activeIndex,
  );

  return (
    <div ref={wrapperRef} className={RESULTS_WRAPPER_CLASS}>
      <KBarResults
        items={results}
        maxHeight={maxHeight}
        onRender={({ item, active }) =>
          typeof item === 'string' ? (
            <SectionLabel key={item} name={item} active={active} />
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
      {/* A live region announces changes, so it is always here, empty (no height) while results show. */}
      <p role="status" className={cn(NO_RESULTS_CLASS, empty && 'py-2.5')}>
        {empty ? NO_RESULTS_TEXT : ''}
      </p>
    </div>
  );
}

/**
 * Around kbar's scroller (the results region). The panel clips anything outside its edges, which
 * the region meets at its sides, so the region's focus ring (the site's one ring) is drawn inside
 * its box rather than 2 px out.
 */
const RESULTS_WRAPPER_CLASS = 'py-1.5 [&>[role=region]:focus-visible]:-outline-offset-2';

/** The no-results line: a result row's size and inset, in the idle row's colour. */
const NO_RESULTS_CLASS = 'px-5 text-body-sm text-muted-foreground';

/**
 * kbar's results scroller (the wrapper's first child) scrolls options that are never focused: the
 * search box drives them (the arrow keys move the active option, aria-activedescendant points at
 * it). Left alone, Chrome made the scroller a keyboard stop with no name; out of the Tab order,
 * nothing in it could be reached from the keyboard and axe failed it (scrollable-region-focusable).
 * So it is a region named "Search results" and the palette's second Tab stop, after the search box
 * (useTabWithinPalette). While nothing matches it is hidden: it holds nothing and has no height,
 * so there is no empty listbox for a screen reader, nor an empty stop for Tab. kbar sets none of
 * these attributes on it, so React never writes them back.
 */
const useResultsRegion = (wrapperRef: RefObject<HTMLElement | null>, empty: boolean): void => {
  useLayoutEffect(() => {
    const scroller = wrapperRef.current?.firstElementChild;
    if (!scroller) return;
    scroller.setAttribute('role', 'region');
    scroller.setAttribute('aria-label', RESULTS_REGION_LABEL);
    scroller.setAttribute('tabindex', '0');
  }, [wrapperRef]);

  useLayoutEffect(() => {
    wrapperRef.current?.firstElementChild?.toggleAttribute('hidden', empty);
  }, [wrapperRef, empty]);
};

/**
 * kbar marks the search box expanded whenever the palette is showing, even over an empty list
 * (and sets aria-expanded after the props it is given, so no prop can change it). So it is
 * collapsed while nothing matches, the "No results" line saying why, and expanded again with the
 * first result. React writes the attribute again only when the palette starts or stops showing, in
 * the same commits that change `showing` here, after which this runs.
 */
const useExpandedOnlyWithResults = (query: KBarQuery, showing: boolean, empty: boolean): void => {
  useLayoutEffect(() => {
    searchBoxOf(query)?.setAttribute('aria-expanded', String(showing && !empty));
  }, [query, showing, empty]);
};

/**
 * kbar points the search box's aria-activedescendant at the active row's id whatever is there:
 * nothing when the list is empty, for a moment after a new search a section name (kbar moves the
 * active index off it an effect later), or a row its virtualised list has not drawn yet (the list
 * draws rows only once it has measured its scroller, a frame or more after results come back:
 * 15 to 41 ms in Chromium). It sets the attribute after the props it is given, so no prop can clear
 * it. So the attribute is set only while the active row is an action and that row is on the page,
 * and looked at again whenever the list draws or drops rows. React writes it again only when the
 * active index changes, in the same commits in which this effect runs.
 */
const useActiveDescendantOnlyOnARenderedOption = (
  query: KBarQuery,
  wrapperRef: RefObject<HTMLElement | null>,
  activeIsOption: boolean,
  activeIndex: number,
): void => {
  useLayoutEffect(() => {
    const searchBox = searchBoxOf(query);
    const listbox = wrapperRef.current?.querySelector('[role="listbox"]');
    if (!searchBox || !listbox) return;
    const id = getListboxItemId(activeIndex);
    const point = () => {
      if (activeIsOption && document.getElementById(id))
        searchBox.setAttribute('aria-activedescendant', id);
      else searchBox.removeAttribute('aria-activedescendant');
    };
    point();
    const rows = new MutationObserver(point);
    rows.observe(listbox, { childList: true });
    return () => rows.disconnect();
  }, [query, wrapperRef, activeIsOption, activeIndex]);
};

/**
 * A section name in the results ("Navigation"). kbar wraps every row it renders, section names
 * included, in a role="option" box and takes nothing from onRender to change that. The arrow keys
 * skip section names and they take no click, so they are not options: while one is shown, its
 * box is plain markup (role none, no aria-selected). kbar keys its rows by position, so the same
 * box may hold an action after the next search: on unmount the box is handed back as kbar rendered
 * it (role option, aria-selected as of this row's last render), which is what React expects to
 * find there.
 */
const SectionLabel = ({
  name,
  active,
}: {
  readonly name: string;
  readonly active: boolean;
}): JSX.Element => {
  const labelRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const row = labelRef.current?.parentElement;
    if (!row) return;
    row.setAttribute('role', 'none');
    row.removeAttribute('aria-selected');
    return () => {
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', String(active));
    };
  }, [active]);

  return (
    <div ref={labelRef} className="label-mono px-5 pt-3 pb-1 text-faint">
      {name}
    </div>
  );
};

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
