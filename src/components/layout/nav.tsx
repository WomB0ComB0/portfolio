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

import { useKBar, VisualState } from 'kbar';
import Link from 'next/link';
import { memo, type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import type { IconType } from 'react-icons';
import {
  FiArrowUpRight,
  FiBriefcase,
  FiCode,
  FiCommand,
  FiGlobe,
  FiHome,
  FiShield,
  FiUser,
} from 'react-icons/fi';
import { PALETTE_DIALOG_LABEL, usePaletteShortcut, withShortcut } from '@/components/cmd';
import { NavbarItems } from '@/constants/index';
import {
  ECOSYSTEM_SECTION,
  type EcosystemSite,
  NETWORK_ECOSYSTEM_SITES,
  VENTURE_ECOSYSTEM_SITES,
  VENTURES_SECTION,
} from '@/lib/navigation/ecosystem';
import { cn } from '@/lib/utils';

export type NavGroupId = 'professional' | 'developer' | 'personal' | 'legal';
type RailFlyoutId = NavGroupId | 'ecosystem';

const ECOSYSTEM_FLYOUT_ID = 'nav-flyout-ecosystem';
const ECOSYSTEM_EXTERNAL_ICON_SIZE = '0.875rem';

export interface NavItem {
  readonly name: string;
  readonly slug: string;
  readonly icon: IconType;
}

export interface NavGroupData {
  readonly id: NavGroupId;
  readonly label: string;
  readonly icon: IconType;
  readonly items: readonly NavItem[];
}

interface NavGroupDefinition extends Omit<NavGroupData, 'items'> {
  readonly slugs: ReadonlySet<string>;
}

const HOME_SLUG = '/';

/** The groups in display order, and the routes each one holds. */
const GROUP_DEFINITIONS: readonly NavGroupDefinition[] = [
  {
    id: 'professional',
    label: 'Professional',
    icon: FiBriefcase,
    slugs: new Set(['/experience', '/certifications', '/resume', '/projects']),
  },
  {
    id: 'developer',
    label: 'Developer',
    icon: FiCode,
    slugs: new Set(['/sponsor', '/stats', '/media']),
  },
  {
    id: 'personal',
    label: 'Personal',
    icon: FiUser,
    slugs: new Set(['/guestbook', '/places', '/spotify']),
  },
  {
    id: 'legal',
    label: 'Legal',
    icon: FiShield,
    slugs: new Set(['/privacy', '/licenses', '/cookies']),
  },
];

/**
 * Every nav group with its pages, in display order. The desktop rail and the mobile menu both
 * render from this, so a page added to NavbarItems and a group shows up in both. Pages keep the
 * NavbarItems order.
 */
export const NAV_GROUPS: readonly NavGroupData[] = GROUP_DEFINITIONS.map(({ slugs, ...group }) => ({
  ...group,
  items: NavbarItems.filter((item) => slugs.has(item.slug)),
}));

export const HOME_NAV_ITEM: NavItem | undefined = NavbarItems.find(
  (item) => item.slug === HOME_SLUG,
);

/** Whether `path` is the page itself or one of its detail pages, e.g. /projects/some-id. */
const isWithinPage = (slug: string, path: string): boolean =>
  path === slug || path.startsWith(`${slug}/`);

/** Whether the current page belongs to the group, which the rail marks on its trigger. */
const isGroupActive = (group: NavGroupData, path: string): boolean =>
  group.items.some((item) => isWithinPage(item.slug, path));

/** A nav link's aria-current: its own page, its section (on a detail page under it), or none. */
export type NavLinkCurrent = 'page' | 'true' | undefined;

/**
 * How a nav link is marked on `path`: 'page' on its own page, 'true' on one of its detail pages
 * (the section, as the rail's trigger marks it), nothing elsewhere. Every nav that lists the
 * pages marks them by this one rule, for sight and for assistive tech alike.
 */
export const navLinkCurrent = (slug: string, path: string): NavLinkCurrent => {
  if (path === slug) return 'page';
  return isWithinPage(slug, path) ? 'true' : undefined;
};

/** The id of a group's flyout panel, which its trigger names in aria-controls. */
const navFlyoutId = (id: NavGroupId): string => `nav-flyout-${id}`;

/** Rail icons and flyout icons, in rem so they follow the browser's font size. */
const RAIL_ICON_SIZE = '1.125rem';
const FLYOUT_ICON_SIZE = '1rem';

/** Every rail button and link: a 44 px target. */
const RAIL_ITEM =
  'relative inline-flex size-11 shrink-0 items-center justify-center rounded-lg transition-colors duration-(--motion-fast) ease-standard';

/** A rail item that is neither the current page's nor open. */
const RAIL_ITEM_IDLE = 'text-muted-foreground hover:bg-surface-2 hover:text-foreground';

/** A group trigger whose flyout is open while the current page is elsewhere. */
const RAIL_ITEM_OPEN = 'bg-surface-2 text-foreground';

/**
 * The current page's rail item: a raised fill and a 2 px brand bar on the rail's left edge. The
 * nav's px-2 plus the 2 px left over around the 44 px item put that edge 10 px (left-2.5) away.
 */
const RAIL_ITEM_CURRENT =
  'bg-surface-3 text-foreground before:absolute before:-left-2.5 before:top-1/2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-brand';

const railItemState = (isCurrent: boolean, isOpen = false): string => {
  if (isCurrent) return RAIL_ITEM_CURRENT;
  return isOpen ? RAIL_ITEM_OPEN : RAIL_ITEM_IDLE;
};

const FLYOUT_LINK =
  'flex items-center gap-3 rounded-md px-2.5 py-2 text-body-sm transition-colors duration-(--motion-fast) ease-standard';
const FLYOUT_LINK_IDLE = 'text-foreground hover:bg-surface-3';
const FLYOUT_LINK_CURRENT = 'bg-brand-subtle font-medium text-brand-ink';
/** The section of a detail page: brand-ink, without the page's own fill. */
const FLYOUT_LINK_SECTION = 'text-brand-ink hover:bg-surface-3';

const FLYOUT_LINK_STATE = {
  page: FLYOUT_LINK_CURRENT,
  true: FLYOUT_LINK_SECTION,
} as const;

/**
 * A group's flyout panel, beside its trigger. It is always in the HTML, open or closed, so its
 * links are plain `<a href>` in every page's server HTML: a crawler presses no button.
 * Visibility is in the transition, so a closing panel stays visible until its fade ends.
 */
const FLYOUT_PANEL =
  'absolute top-0 left-full z-50 ml-4 min-w-52 rounded-tile border border-hairline bg-surface-2 p-1.5 shadow-raised transition-[opacity,translate,visibility] duration-(--motion-fast) ease-out-expo';

/** Open: faded in and slid the last 6 px in from the rail. */
const FLYOUT_OPEN = 'visible translate-x-0 opacity-100';

/**
 * Closed: `invisible` (visibility: hidden) takes the panel and its links out of the tab order,
 * the accessibility tree and hit testing while they stay in the HTML; the panel is `inert` too.
 */
const FLYOUT_CLOSED = 'invisible -translate-x-1.5 opacity-0';

interface FlyoutDismissOptions {
  readonly isOpen: boolean;
  readonly containerRef: RefObject<HTMLElement | null>;
  readonly triggerRef: RefObject<HTMLElement | null>;
  readonly onClose: () => void;
}

/**
 * While a flyout is open, it closes on Escape, on a press anywhere outside the group (trigger and
 * panel), and when keyboard focus moves out of the group (the WAI-ARIA disclosure navigation
 * pattern). Escape puts focus back on the trigger only when focus was in the group, so it never
 * pulls focus out of a page field.
 */
const useFlyoutDismiss = ({
  isOpen,
  containerRef,
  triggerRef,
  onClose,
}: FlyoutDismissOptions): void => {
  useEffect(() => {
    const container = containerRef.current;
    if (!isOpen || !container) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      const hadFocus = container.contains(document.activeElement);
      onClose();
      if (hadFocus) triggerRef.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      const { target } = event;
      if (target instanceof Node && container.contains(target)) return;
      onClose();
    };
    // Focus moving to nothing (a click on the panel's own text, a switch to another window) has a
    // null relatedTarget and keeps the flyout open; a click outside is onPointerDown's job.
    const onFocusOut = (event: FocusEvent) => {
      const { relatedTarget } = event;
      if (relatedTarget instanceof Node && !container.contains(relatedTarget)) onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('focusout', onFocusOut);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('focusout', onFocusOut);
    };
  }, [isOpen, containerRef, triggerRef, onClose]);
};

interface NavFlyoutLinkProps {
  readonly item: NavItem;
  /** The page itself, its section (a detail page under it), or neither. */
  readonly current: NavLinkCurrent;
  /** Whether the link's flyout is open. A closed flyout's links are hidden, but still laid out. */
  readonly isShown: boolean;
  readonly onNavigate: () => void;
}

/**
 * A page's link in a flyout. Next prefetches a link once its box is in the viewport, whether or
 * not it is visible, so a closed flyout's link opts out: the route is prefetched when the
 * flyout opens, as it was when the link was only mounted then.
 */
const NavFlyoutLink = ({ item, current, isShown, onNavigate }: NavFlyoutLinkProps) => (
  <Link
    href={item.slug}
    prefetch={isShown ? undefined : false}
    onClick={onNavigate}
    aria-current={current}
    className={cn(FLYOUT_LINK, current ? FLYOUT_LINK_STATE[current] : FLYOUT_LINK_IDLE)}
  >
    <item.icon size={FLYOUT_ICON_SIZE} className="shrink-0" aria-hidden />
    <span>{item.name}</span>
  </Link>
);

interface NavGroupProps {
  readonly group: NavGroupData;
  readonly path: string;
  readonly isOpen: boolean;
  readonly onToggle: (id: NavGroupId) => void;
  readonly onClose: () => void;
}

/**
 * One rail group: an icon trigger and the flyout of its pages. The rail keeps which group is open,
 * so only one flyout shows at a time. Every flyout is rendered, open or not (see FLYOUT_PANEL).
 */
const NavGroup = memo(({ group, path, isOpen, onToggle, onClose }: NavGroupProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useFlyoutDismiss({ isOpen, containerRef, triggerRef, onClose });

  const isActive = isGroupActive(group, path);
  const panelId = navFlyoutId(group.id);
  const labelId = `${panelId}-label`;
  const Icon = group.icon;

  return (
    <div ref={containerRef} className="relative flex w-full flex-col items-center">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => onToggle(group.id)}
        className={cn(RAIL_ITEM, railItemState(isActive, isOpen))}
        aria-label={`${group.label} section`}
        // Marked for sight (fill and brand bar) whenever the page is in the group; this says so to
        // assistive tech, which a closed flyout's links never reach.
        aria-current={isActive ? 'true' : undefined}
        aria-expanded={isOpen}
        aria-controls={panelId}
      >
        <Icon size={RAIL_ICON_SIZE} strokeWidth={isActive ? 2.5 : 2} aria-hidden />
      </button>

      <div
        id={panelId}
        inert={!isOpen}
        className={cn(FLYOUT_PANEL, isOpen ? FLYOUT_OPEN : FLYOUT_CLOSED)}
      >
        <div id={labelId} className="label-mono px-2.5 pt-2 pb-1 text-faint">
          {group.label}
        </div>
        <ul aria-labelledby={labelId} className="flex flex-col gap-0.5">
          {group.items.map((item) => (
            <li key={item.slug}>
              <NavFlyoutLink
                item={item}
                current={navLinkCurrent(item.slug, path)}
                isShown={isOpen}
                onNavigate={onClose}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
});
NavGroup.displayName = 'NavGroup';

const HomeRailLink = ({ item, path }: { readonly item: NavItem; readonly path: string }) => {
  const isCurrent = path === item.slug;
  return (
    <Link
      href={item.slug}
      prefetch={false}
      className={cn(RAIL_ITEM, railItemState(isCurrent))}
      aria-label={item.name}
      aria-current={isCurrent ? 'page' : undefined}
    >
      <FiHome size={RAIL_ICON_SIZE} strokeWidth={isCurrent ? 2.5 : 2} aria-hidden />
    </Link>
  );
};

/**
 * The rail tooltip, at rest: hidden, fading in and out on opacity alone, and taking no pointer, so
 * an invisible tooltip never catches a hover or a click. Its ::before is a transparent bridge over
 * the 16px gap (ml-4), reaching a little onto the button past the tooltip's 1px border.
 */
const PALETTE_TIP_CLASS =
  'pointer-events-none absolute top-1/2 left-full z-50 ml-4 flex -translate-y-1/2 items-center gap-2 whitespace-nowrap rounded-md border border-hairline bg-surface-2 px-2.5 py-1.5 text-body-sm text-foreground opacity-0 shadow-raised transition-opacity duration-(--motion-fast) ease-standard before:absolute before:inset-y-0 before:right-full before:w-5 before:content-[""]';
/**
 * Shown while the button is hovered or has keyboard focus, unless Escape dismissed it. Shown on
 * hover it takes the pointer, bridge included: it is inside the button, so the pointer can move
 * onto it and the button stays hovered (WCAG 1.4.13, hoverable).
 */
const PALETTE_TIP_SHOWN_CLASS =
  'group-hover/palette:pointer-events-auto group-hover/palette:opacity-100 group-focus-visible/palette:opacity-100';

type TipTrigger = 'hovered' | 'focused';

/**
 * Escape for the rail tooltip (WCAG 1.4.13): while the button is hovered or focused, Escape hides
 * the tooltip and leaves focus and the pointer where they are. It stays hidden until both have
 * left, so the next hover or focus shows it again.
 */
function useEscapableTip() {
  const [isDismissed, setIsDismissed] = useState(false);
  const triggers = useRef<Readonly<Record<TipTrigger, boolean>>>({
    hovered: false,
    focused: false,
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const { hovered, focused } = triggers.current;
      if (event.key === 'Escape' && (hovered || focused)) setIsDismissed(true);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const set = useCallback((trigger: TipTrigger, isOn: boolean) => {
    triggers.current = { ...triggers.current, [trigger]: isOn };
    if (!triggers.current.hovered && !triggers.current.focused) setIsDismissed(false);
  }, []);

  return {
    isDismissed,
    onPointerEnter: () => set('hovered', true),
    onPointerLeave: () => set('hovered', false),
    onFocus: () => set('focused', true),
    onBlur: () => set('focused', false),
  };
}

/**
 * Opens the command palette. A tooltip beside the rail names it and its shortcut on hover and on
 * keyboard focus, and Escape dismisses it. The tooltip is the button's own text, so its name is
 * the tooltip's words, the shortcut included ('Command menu, ⌘K', WCAG 2.5.3: it starts with what
 * a voice user sees); aria-keyshortcuts gives the keys as well.
 */
const PaletteRailButton = ({ onOpen }: { readonly onOpen: () => void }) => {
  const shortcut = usePaletteShortcut();
  const { isDismissed, ...tipTriggers } = useEscapableTip();
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(RAIL_ITEM, RAIL_ITEM_IDLE, 'group/palette')}
      aria-label={withShortcut(PALETTE_DIALOG_LABEL, shortcut)}
      aria-keyshortcuts={shortcut.keys}
      {...tipTriggers}
    >
      <FiCommand size={RAIL_ICON_SIZE} aria-hidden />
      <span
        aria-hidden="true"
        data-palette-tip=""
        className={cn(PALETTE_TIP_CLASS, !isDismissed && PALETTE_TIP_SHOWN_CLASS)}
      >
        {/* The space keeps 'menu' and 'Ctrl' two words for a name check (the gap is the
            flexbox's, which draws no space-only text). */}
        {PALETTE_DIALOG_LABEL}{' '}
        <kbd className="font-mono text-label text-muted-foreground">{shortcut.label}</kbd>
      </span>
    </button>
  );
};

const EcosystemFlyoutItem = ({
  site,
  path,
  onClose,
}: {
  readonly site: EcosystemSite;
  readonly path: string;
  readonly onClose: () => void;
}) => {
  const Icon = site.icon;
  if (site.current) {
    return (
      <Link
        href={site.internalPath ?? '/'}
        prefetch={false}
        onClick={onClose}
        aria-current={path === '/' ? 'page' : undefined}
        className={cn(FLYOUT_LINK, FLYOUT_LINK_CURRENT)}
      >
        <Icon size={FLYOUT_ICON_SIZE} className="shrink-0" aria-hidden />
        <span className="flex-1 truncate">{site.name}</span>
        <span className="mono-token text-brand-ink">here</span>
      </Link>
    );
  }
  if (site.internalPath) {
    const current = navLinkCurrent(site.internalPath, path);
    return (
      <Link
        href={site.internalPath}
        prefetch={false}
        onClick={onClose}
        aria-current={current}
        className={cn(FLYOUT_LINK, current ? FLYOUT_LINK_STATE[current] : FLYOUT_LINK_IDLE)}
      >
        <Icon size={FLYOUT_ICON_SIZE} className="shrink-0 text-faint" aria-hidden />
        <span className="flex-1 truncate">{site.name}</span>
        <FiArrowUpRight
          size={ECOSYSTEM_EXTERNAL_ICON_SIZE}
          className="shrink-0 text-faint"
          aria-hidden
        />
      </Link>
    );
  }
  return (
    <a
      href={site.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClose}
      className={cn(FLYOUT_LINK, FLYOUT_LINK_IDLE)}
    >
      <Icon size={FLYOUT_ICON_SIZE} className="shrink-0 text-faint" aria-hidden />
      <span className="flex-1 truncate">{site.name}</span>
      <FiArrowUpRight
        size={ECOSYSTEM_EXTERNAL_ICON_SIZE}
        className="shrink-0 text-faint"
        aria-hidden
      />
    </a>
  );
};

interface EcosystemFlyoutProps {
  readonly path: string;
  readonly isOpen: boolean;
  readonly onToggle: () => void;
  readonly onClose: () => void;
}

/**
 * Cross-property switcher for *.mikeodnis.dev and ventures. Unlike the internal page groups, its
 * panel mounts only while open so server HTML and crawler link checks keep only this site's own
 * routes, and aria-controls points at the panel only while it is in the DOM.
 */
const EcosystemFlyout = memo(({ path, isOpen, onToggle, onClose }: EcosystemFlyoutProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useFlyoutDismiss({ isOpen, containerRef, triggerRef, onClose });

  const networkLabelId = `${ECOSYSTEM_FLYOUT_ID}-network-label`;
  const venturesLabelId = `${ECOSYSTEM_FLYOUT_ID}-ventures-label`;

  return (
    <div ref={containerRef} className="relative flex w-full flex-col items-center">
      <button
        ref={triggerRef}
        type="button"
        onClick={onToggle}
        className={cn(RAIL_ITEM, railItemState(false, isOpen))}
        aria-label={`${ECOSYSTEM_SECTION} network`}
        aria-expanded={isOpen}
        aria-controls={isOpen ? ECOSYSTEM_FLYOUT_ID : undefined}
      >
        <FiGlobe size={RAIL_ICON_SIZE} aria-hidden />
      </button>

      {isOpen && (
        <div
          id={ECOSYSTEM_FLYOUT_ID}
          className="absolute top-0 left-full z-50 ml-4 max-h-[calc(100dvh-18.75rem)] min-w-60 overflow-y-auto overscroll-contain rounded-tile border border-hairline bg-surface-2 p-1.5 shadow-raised"
        >
          <div id={networkLabelId} className="label-mono px-2.5 pt-2 pb-1 text-faint">
            {ECOSYSTEM_SECTION}
          </div>
          <ul aria-labelledby={networkLabelId} className="flex flex-col gap-0.5">
            {NETWORK_ECOSYSTEM_SITES.map((site) => (
              <li key={site.id}>
                <EcosystemFlyoutItem site={site} path={path} onClose={onClose} />
              </li>
            ))}
          </ul>

          <div aria-hidden="true" className="my-1.5 h-px bg-hairline" />

          <div id={venturesLabelId} className="label-mono px-2.5 pt-1 pb-1 text-faint">
            {VENTURES_SECTION}
          </div>
          <ul aria-labelledby={venturesLabelId} className="flex flex-col gap-0.5">
            {VENTURE_ECOSYSTEM_SITES.map((site) => (
              <li key={site.id}>
                <EcosystemFlyoutItem site={site} path={path} onClose={onClose} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
});
EcosystemFlyout.displayName = 'EcosystemFlyout';

export const NavBar = memo(({ path }: { path: string }) => {
  const { query, isPaletteShown } = useKBar((state) => ({
    isPaletteShown: state.visualState !== VisualState.hidden,
  }));
  const [openGroupId, setOpenGroupId] = useState<RailFlyoutId | null>(null);
  // The shell stays mounted across navigations, so a route change the rail didn't make itself
  // (Back, Forward) must close the open flyout here, or it stays open over the new page.
  const [groupsPath, setGroupsPath] = useState(path);
  if (groupsPath !== path) {
    setGroupsPath(path);
    setOpenGroupId(null);
  }

  const toggleGroup = useCallback(
    (id: RailFlyoutId) => setOpenGroupId((current) => (current === id ? null : id)),
    [],
  );
  const toggleEcosystem = useCallback(() => toggleGroup('ecosystem'), [toggleGroup]);
  const closeGroups = useCallback(() => setOpenGroupId(null), []);

  // The palette opens over the rail (⌘K needs no click outside), so a flyout left open under it
  // would also take the palette's Escape and pull focus back to the rail.
  useEffect(() => {
    if (isPaletteShown) closeGroups();
  }, [isPaletteShown, closeGroups]);

  return (
    <div className="flex h-full w-16 flex-col items-center gap-3 border-r border-hairline bg-canvas/80 py-6 backdrop-blur-md">
      <nav className="flex w-full flex-col items-center gap-2 px-2" aria-label="Main navigation">
        {HOME_NAV_ITEM && <HomeRailLink item={HOME_NAV_ITEM} path={path} />}

        {NAV_GROUPS.map((group) => (
          <NavGroup
            key={group.id}
            group={group}
            path={path}
            isOpen={openGroupId === group.id}
            onToggle={toggleGroup}
            onClose={closeGroups}
          />
        ))}

        <EcosystemFlyout
          path={path}
          isOpen={openGroupId === 'ecosystem'}
          onToggle={toggleEcosystem}
          onClose={closeGroups}
        />

        <div aria-hidden="true" className="my-1 h-px w-8 bg-hairline" />

        <PaletteRailButton onOpen={query.toggle} />
      </nav>
    </div>
  );
});
NavBar.displayName = 'NavBar';
