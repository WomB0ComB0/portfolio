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
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { memo, type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import type { IconType } from 'react-icons';
import { FiBriefcase, FiCode, FiCommand, FiHome, FiShield, FiUser } from 'react-icons/fi';
import { usePaletteShortcut } from '@/components/cmd';
import { NavbarItems } from '@/constants/index';
import { DURATION_MS, EASE, seconds } from '@/lib/design/motion';
import { cn } from '@/lib/utils';

export type NavGroupId = 'professional' | 'developer' | 'personal' | 'legal';

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
export const isGroupActive = (group: NavGroupData, path: string): boolean =>
  group.items.some((item) => isWithinPage(item.slug, path));

/** The id of a group's flyout panel, which its trigger names in aria-controls. */
export const navFlyoutId = (id: NavGroupId): string => `nav-flyout-${id}`;

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

/** A flyout slides this far in from the rail as it fades in, in px. */
const FLYOUT_OFFSET_PX = -6;
const FLYOUT_HIDDEN = { opacity: 0, x: FLYOUT_OFFSET_PX } as const;
const FLYOUT_SHOWN = { opacity: 1, x: 0 } as const;
const FLYOUT_TRANSITION = { duration: seconds(DURATION_MS.fast), ease: EASE.outExpo } as const;

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
  readonly isCurrent: boolean;
  readonly onNavigate: () => void;
}

const NavFlyoutLink = ({ item, isCurrent, onNavigate }: NavFlyoutLinkProps) => (
  <Link
    href={item.slug}
    onClick={onNavigate}
    aria-current={isCurrent ? 'page' : undefined}
    className={cn(FLYOUT_LINK, isCurrent ? FLYOUT_LINK_CURRENT : FLYOUT_LINK_IDLE)}
  >
    <item.icon size={FLYOUT_ICON_SIZE} className="shrink-0" aria-hidden />
    <span>{item.name}</span>
  </Link>
);

export interface NavGroupProps {
  readonly group: NavGroupData;
  readonly path: string;
  readonly isOpen: boolean;
  readonly onToggle: (id: NavGroupId) => void;
  readonly onClose: () => void;
}

/**
 * One rail group: an icon trigger and the flyout of its pages. The rail keeps which group is open,
 * so only one flyout shows at a time.
 */
export const NavGroup = memo(({ group, path, isOpen, onToggle, onClose }: NavGroupProps) => {
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
        aria-expanded={isOpen}
        aria-controls={panelId}
      >
        <Icon size={RAIL_ICON_SIZE} strokeWidth={isActive ? 2.5 : 2} aria-hidden />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            id={panelId}
            initial={FLYOUT_HIDDEN}
            animate={FLYOUT_SHOWN}
            exit={FLYOUT_HIDDEN}
            transition={FLYOUT_TRANSITION}
            className="absolute top-0 left-full z-50 ml-4 min-w-52 rounded-tile border border-hairline bg-surface-2 p-1.5 shadow-raised"
          >
            <div id={labelId} className="label-mono px-2.5 pt-2 pb-1 text-faint">
              {group.label}
            </div>
            <ul aria-labelledby={labelId} className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <li key={item.slug}>
                  <NavFlyoutLink item={item} isCurrent={path === item.slug} onNavigate={onClose} />
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
NavGroup.displayName = 'NavGroup';

const HomeRailLink = ({ item, path }: { readonly item: NavItem; readonly path: string }) => {
  const isCurrent = path === item.slug;
  return (
    <Link
      href={item.slug}
      className={cn(RAIL_ITEM, railItemState(isCurrent))}
      aria-label={item.name}
      aria-current={isCurrent ? 'page' : undefined}
    >
      <FiHome size={RAIL_ICON_SIZE} strokeWidth={isCurrent ? 2.5 : 2} aria-hidden />
    </Link>
  );
};

/**
 * Opens the command palette. A tooltip beside the rail names it and its shortcut on hover and on
 * keyboard focus; aria-keyshortcuts gives assistive tech the same shortcut.
 */
const PaletteRailButton = ({ onOpen }: { readonly onOpen: () => void }) => {
  const shortcut = usePaletteShortcut();
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(RAIL_ITEM, RAIL_ITEM_IDLE, 'group/palette')}
      aria-label="Open command menu"
      aria-keyshortcuts={shortcut.keys}
    >
      <FiCommand size={RAIL_ICON_SIZE} aria-hidden />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-full z-50 ml-4 flex -translate-y-1/2 items-center gap-2 whitespace-nowrap rounded-md border border-hairline bg-surface-2 px-2.5 py-1.5 text-body-sm text-foreground opacity-0 shadow-raised transition-opacity duration-(--motion-fast) ease-standard group-hover/palette:opacity-100 group-focus-visible/palette:opacity-100"
      >
        Command menu
        <kbd className="font-mono text-label text-muted-foreground">{shortcut.label}</kbd>
      </span>
    </button>
  );
};

export const NavBar = memo(({ path }: { path: string }) => {
  const { query, isPaletteShown } = useKBar((state) => ({
    isPaletteShown: state.visualState !== VisualState.hidden,
  }));
  const [openGroupId, setOpenGroupId] = useState<NavGroupId | null>(null);
  // The shell stays mounted across navigations, so a route change the rail didn't make itself
  // (Back, Forward) must close the open flyout here, or it stays open over the new page.
  const [groupsPath, setGroupsPath] = useState(path);
  if (groupsPath !== path) {
    setGroupsPath(path);
    setOpenGroupId(null);
  }

  const toggleGroup = useCallback(
    (id: NavGroupId) => setOpenGroupId((current) => (current === id ? null : id)),
    [],
  );
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

        <div aria-hidden="true" className="my-1 h-px w-8 bg-hairline" />

        <PaletteRailButton onOpen={query.toggle} />
      </nav>
    </div>
  );
});
NavBar.displayName = 'NavBar';
export default NavBar;
