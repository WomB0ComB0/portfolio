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

import type { Action } from 'kbar';
import { createElement } from 'react';
import type { IconType } from 'react-icons';
import {
  FiAward,
  FiBarChart,
  FiBookOpen,
  FiBriefcase,
  FiClipboard,
  FiFileText,
  FiHeadphones,
  FiHeart,
  FiHome,
  FiMapPin,
  FiVideo,
} from 'react-icons/fi';

/** The palette section every page action is listed under. */
export const NAVIGATION_SECTION = 'Navigation';

/** Pixel size of the icon shown beside each page action in the palette. */
const ACTION_ICON_SIZE = 18;

/**
 * A page the command palette can jump to.
 *
 * `key` is a letter, pressed together with Alt (Option on a Mac) while the palette is open. It is
 * never bound as a bare, page-wide key: WCAG 2.1.4 rules out single-character shortcuts that fire
 * everywhere, and inside the palette a bare letter belongs to the search box.
 */
export interface NavigationShortcut {
  readonly id: string;
  readonly name: string;
  readonly href: string;
  readonly key: string;
  readonly keywords: string;
  readonly icon: IconType;
}

export const NAVIGATION_SHORTCUTS: readonly NavigationShortcut[] = [
  { id: 'home', name: 'Home', href: '/', key: 'h', keywords: 'home', icon: FiHome },
  {
    id: 'projects',
    name: 'Projects',
    href: '/projects',
    key: 'p',
    keywords: 'projects portfolio work code',
    icon: FiBriefcase,
  },
  {
    id: 'experience',
    name: 'Experience',
    href: '/experience',
    key: 'x',
    keywords: 'experience work history jobs',
    icon: FiClipboard,
  },
  {
    id: 'certifications',
    name: 'Certifications',
    href: '/certifications',
    key: 'c',
    keywords: 'certifications credentials certificates',
    icon: FiAward,
  },
  {
    id: 'resume',
    name: 'Resume',
    href: '/resume',
    key: 'r',
    keywords: 'resume cv',
    icon: FiFileText,
  },
  {
    id: 'media',
    name: 'Media',
    href: '/media',
    key: 'm',
    keywords: 'media blog writing articles posts presentations talks videos',
    icon: FiVideo,
  },
  {
    id: 'places',
    name: 'Places',
    href: '/places',
    key: 'l',
    keywords: 'places locations map travel',
    icon: FiMapPin,
  },
  {
    id: 'spotify',
    name: 'Spotify',
    href: '/spotify',
    key: 's',
    keywords: 'spotify music stats listening',
    icon: FiHeadphones,
  },
  {
    id: 'guestbook',
    name: 'Guestbook',
    href: '/guestbook',
    key: 'g',
    keywords: 'guestbook messages comments',
    icon: FiBookOpen,
  },
  {
    id: 'stats',
    name: 'Stats',
    href: '/stats',
    key: 'd',
    keywords: 'stats analytics',
    icon: FiBarChart,
  },
  {
    // A letter, not the old '$': Option+Shift+4 types '›' on a Mac and has no letter key code.
    id: 'sponsor',
    name: 'Sponsor',
    href: '/sponsor',
    key: 'o',
    keywords: 'sponsor support donate contribute funding',
    icon: FiHeart,
  },
];

/**
 * Builds the palette's page actions around a client-side navigate function (the App Router's
 * `router.push`), so choosing one never reloads the page.
 *
 * The actions deliberately carry no kbar `shortcut`: kbar binds every action shortcut as a
 * page-wide key while the palette is closed. The palette handles `key` itself, only while open.
 */
export const createNavigationActions = (navigate: (href: string) => void): Action[] =>
  NAVIGATION_SHORTCUTS.map(({ id, name, href, keywords, icon }) => ({
    id,
    name,
    keywords,
    section: NAVIGATION_SECTION,
    icon: createElement(icon, { size: ACTION_ICON_SIZE, 'aria-hidden': true }),
    perform: () => navigate(href),
  }));

/** `KeyboardEvent.code` of the physical key for a letter, e.g. 'KeyG' for 'g'. */
const letterKeyCode = (letter: string): string => `Key${letter.toUpperCase()}`;

/**
 * What Option+letter types on the macOS US (ABC) layout, for each shortcut letter. A Mac reports
 * that character as `key`, not the letter. Other Mac layouts type real text with Option (Option+L
 * is 'ł' on Polish Pro and '@' on German), so only these exact characters count as a shortcut.
 * On the US layout Option+E, I, N and U are dead keys, which report 'Dead': a shortcut on one of
 * those letters would map to 'Dead' here.
 */
const US_MAC_OPTION_KEYS: Readonly<Record<string, string>> = {
  c: 'ç',
  d: '∂',
  g: '©',
  h: '˙',
  l: '¬',
  m: 'µ',
  o: 'ø',
  p: 'π',
  r: '®',
  s: 'ß',
  x: '≈',
};

type ShortcutKeyPress = Pick<KeyboardEvent, 'key' | 'code' | 'altKey' | 'ctrlKey' | 'metaKey'>;

/** Alt (Option) with no Ctrl or Meta. Ctrl+Alt is AltGr on many layouts, where it types text. */
const isAltOnly = ({ altKey, ctrlKey, metaKey }: ShortcutKeyPress): boolean =>
  altKey && !ctrlKey && !metaKey;

/** The shortcut for the letter the layout typed, which is what the palette's hint shows. */
const byTypedLetter = (key: string): NavigationShortcut | undefined => {
  const typed = key.toLowerCase();
  return NAVIGATION_SHORTCUTS.find((shortcut) => shortcut.key === typed);
};

/** The shortcut for a US-layout Option+letter on a Mac, by its physical key and exact character. */
const byUsMacOptionKey = ({ key, code }: ShortcutKeyPress): NavigationShortcut | undefined =>
  NAVIGATION_SHORTCUTS.find(
    (shortcut) => code === letterKeyCode(shortcut.key) && key === US_MAC_OPTION_KEYS[shortcut.key],
  );

/**
 * The page whose shortcut a key press is: Alt (Option) plus the letter, with no Ctrl or Meta.
 *
 * The typed letter wins, so on Dvorak or Colemak Alt+D opens Stats whichever physical key D is on.
 * The physical key is a fallback only for the character US-layout Option types on a Mac (Option+P
 * types 'π'). Any other character, such as Option+L typing 'ł' on Polish Pro, is left to the search
 * box.
 */
export const findNavigationShortcut = (event: ShortcutKeyPress): NavigationShortcut | undefined => {
  if (!isAltOnly(event)) return undefined;
  return byTypedLetter(event.key) ?? byUsMacOptionKey(event);
};
