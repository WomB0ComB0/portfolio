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
import { Button } from '@/components/ui/button';
import { NavbarItems } from '@/constants/index';
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

/** Seconds between each flyout link's entrance. */
const FLYOUT_STAGGER_S = 0.03;

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
  <Button
    asChild
    variant="ghost"
    className={cn(
      'w-full justify-start gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
      isCurrent ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-accent/50 text-foreground',
    )}
    onClick={onNavigate}
  >
    <Link
      href={item.slug}
      className="flex items-center gap-3"
      aria-current={isCurrent ? 'page' : undefined}
    >
      <item.icon size="1.1rem" aria-hidden />
      <span className="text-sm">{item.name}</span>
    </Link>
  </Button>
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
    <div ref={containerRef} className="relative w-full flex flex-col items-center">
      <Button
        ref={triggerRef}
        variant="ghost"
        size="icon"
        onClick={() => onToggle(group.id)}
        className={cn(
          'w-11 h-11 rounded-xl transition-all duration-200 relative group',
          isActive || isOpen
            ? 'bg-accent text-foreground shadow-sm'
            : 'hover:bg-accent/70 text-muted-foreground hover:text-foreground',
        )}
        aria-label={`${group.label} section`}
        aria-expanded={isOpen}
        aria-controls={panelId}
      >
        <Icon size="1.25rem" strokeWidth={isActive ? 2.5 : 2} aria-hidden />
        {isActive && (
          <span
            aria-hidden
            className="absolute -right-0.5 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-l-full"
          />
        )}
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            id={panelId}
            initial={{ opacity: 0, x: -10, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute left-full ml-3 top-0 z-50 min-w-[200px] bg-card/95 backdrop-blur-xl border border-border/50 rounded-xl shadow-2xl overflow-hidden"
          >
            <div className="p-2 flex flex-col gap-1">
              <div
                id={labelId}
                className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider"
              >
                {group.label}
              </div>
              <ul aria-labelledby={labelId} className="flex flex-col gap-1">
                {group.items.map((item, index) => (
                  <motion.li
                    key={item.slug}
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * FLYOUT_STAGGER_S }}
                  >
                    <NavFlyoutLink
                      item={item}
                      isCurrent={path === item.slug}
                      onNavigate={onClose}
                    />
                  </motion.li>
                ))}
              </ul>
            </div>
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
    <Button
      asChild
      variant="ghost"
      size="icon"
      className={cn(
        'w-11 h-11 rounded-xl transition-all duration-200 relative group',
        isCurrent
          ? 'bg-primary text-primary-foreground shadow-md hover:bg-primary/90'
          : 'hover:bg-accent/70 text-muted-foreground hover:text-foreground',
      )}
      aria-label={item.name}
      aria-current={isCurrent ? 'page' : undefined}
    >
      <Link href={item.slug}>
        <FiHome size="1.25rem" strokeWidth={isCurrent ? 2.5 : 2} aria-hidden />
      </Link>
    </Button>
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
    <div className="w-16 h-full flex flex-col items-center py-6 gap-3 border-r border-border/30">
      <nav className="flex flex-col items-center gap-2 w-full px-2" aria-label="Main navigation">
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

        <div className="w-8 h-px bg-border/50 my-1" />

        <Button
          variant="ghost"
          size="icon"
          className="w-11 h-11 rounded-xl hover:bg-accent/70 text-muted-foreground hover:text-foreground transition-all duration-200"
          onClick={query.toggle}
          aria-label="Open command menu"
        >
          <FiCommand size="1.25rem" aria-hidden />
        </Button>
      </nav>
    </div>
  );
});
NavBar.displayName = 'NavBar';
export default NavBar;
