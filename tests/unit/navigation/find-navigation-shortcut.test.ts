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
 * @file The palette's Alt+letter (Option+letter) shortcuts follow the letter the hint shows, on any
 * keyboard layout, and never take a character the layout types.
 *
 * `key` is what the layout produced and `code` is the physical key, named after its QWERTY letter.
 * On Windows and Linux, Alt+letter reports the typed letter as `key`. On a Mac, Option+letter
 * reports the character the Option layer types, so only the US layout's symbols are shortcuts.
 */

import { describe, expect, it } from 'vitest';
import { findNavigationShortcut, NAVIGATION_SHORTCUTS } from '@/lib/navigation/actions';

type Press = Parameters<typeof findNavigationShortcut>[0];

const alt = (key: string, code: string): Press => ({
  key,
  code,
  altKey: true,
  ctrlKey: false,
  metaKey: false,
});

const idOf = (event: Press): string | undefined => findNavigationShortcut(event)?.id;

/** The physical key (`code`) of each shortcut letter on Dvorak and Colemak. */
const LAYOUTS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  Dvorak: {
    h: 'KeyJ',
    p: 'KeyR',
    x: 'KeyB',
    c: 'KeyI',
    r: 'KeyO',
    m: 'KeyM',
    l: 'KeyP',
    s: 'Semicolon',
    g: 'KeyU',
    d: 'KeyH',
    o: 'KeyS',
  },
  Colemak: {
    h: 'KeyH',
    p: 'KeyR',
    x: 'KeyX',
    c: 'KeyC',
    r: 'KeyS',
    m: 'KeyM',
    l: 'KeyU',
    s: 'KeyD',
    g: 'KeyT',
    d: 'KeyG',
    o: 'Semicolon',
  },
};

/** What Option+letter types on the macOS US (ABC) layout. */
const US_MAC_OPTION: Readonly<Record<string, string>> = {
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

const letterCode = (letter: string): string => `Key${letter.toUpperCase()}`;

const layoutCases = Object.entries(LAYOUTS).flatMap(([layout, codes]) =>
  NAVIGATION_SHORTCUTS.map(({ id, key }) => [layout, key, codes[key] ?? '', id] as const),
);

describe('findNavigationShortcut', () => {
  it.each(NAVIGATION_SHORTCUTS.map(({ id, key }) => [key, id] as const))(
    'opens the page for Alt+%s on QWERTY',
    (letter, id) => {
      expect(idOf(alt(letter, letterCode(letter)))).toBe(id);
    },
  );

  it.each(layoutCases)(
    'follows the typed letter on %s: Alt+%s (physical %s) opens %s',
    (_, letter, code, id) => {
      expect(code).not.toBe('');
      expect(idOf(alt(letter, code))).toBe(id);
    },
  );

  it('opens Stats, not Home, for Alt+D on Dvorak (D sits on the QWERTY H key)', () => {
    expect(idOf(alt('d', 'KeyH'))).toBe('stats');
  });

  it('opens Places, not Projects, for Alt+L on Dvorak (L sits on the QWERTY P key)', () => {
    expect(idOf(alt('l', 'KeyP'))).toBe('places');
  });

  it('opens Stats, not Guestbook, for Alt+D on Colemak (D sits on the QWERTY G key)', () => {
    expect(idOf(alt('d', 'KeyG'))).toBe('stats');
  });

  it.each(NAVIGATION_SHORTCUTS.map(({ id, key }) => [key, US_MAC_OPTION[key] ?? '', id] as const))(
    'opens the page for Option+%s on a US Mac, which types "%s"',
    (letter, symbol, id) => {
      expect(symbol).not.toBe('');
      expect(idOf(alt(symbol, letterCode(letter)))).toBe(id);
    },
  );

  it.each([
    ['Polish Pro', 'ł', 'KeyL'],
    ['Polish Pro', 'ś', 'KeyS'],
    ['Polish Pro', 'ó', 'KeyO'],
    ['Polish Pro', 'ć', 'KeyC'],
    ['Polish Pro', 'ź', 'KeyX'],
    ['German', '@', 'KeyL'],
  ])('leaves Option+key to the search box on a %s Mac, where it types "%s"', (_, key, code) => {
    expect(findNavigationShortcut(alt(key, code))).toBeUndefined();
  });

  it('does nothing, rather than open another page, for a US Option symbol on another key', () => {
    // Mac Dvorak: Option+L types '¬' with the QWERTY P key, which is Projects' physical key.
    expect(findNavigationShortcut(alt('¬', 'KeyP'))).toBeUndefined();
  });

  it('ignores an Option dead key, which starts an accented letter', () => {
    expect(findNavigationShortcut(alt('Dead', 'KeyE'))).toBeUndefined();
    expect(findNavigationShortcut(alt('Dead', 'KeyL'))).toBeUndefined();
  });

  it('ignores an Alt+letter that no shortcut uses', () => {
    expect(findNavigationShortcut(alt('z', 'KeyZ'))).toBeUndefined();
    // Dvorak E sits on the QWERTY D key (Stats' physical key).
    expect(findNavigationShortcut(alt('e', 'KeyD'))).toBeUndefined();
  });

  it('needs Alt, and ignores Ctrl+Alt (AltGr) and Meta+Alt', () => {
    expect(findNavigationShortcut({ ...alt('g', 'KeyG'), altKey: false })).toBeUndefined();
    expect(findNavigationShortcut({ ...alt('g', 'KeyG'), ctrlKey: true })).toBeUndefined();
    expect(findNavigationShortcut({ ...alt('g', 'KeyG'), metaKey: true })).toBeUndefined();
  });

  it('accepts Alt+Shift+letter, which reports the capital', () => {
    expect(idOf(alt('G', 'KeyG'))).toBe('guestbook');
  });
});
