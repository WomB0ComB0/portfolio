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

/**
 * @file The hero's "Jump to…" button: opens the command palette and shows its shortcut.
 *
 * The shortcut comes from the shell's usePaletteShortcut, so the hero, the rail and the phone bar
 * print the same hint: ⌘K in the server HTML and on hydration, Ctrl K right after hydrating on
 * other platforms. '@/components/cmd' is already in every page's bundle (the shell mounts the
 * palette), so importing it here adds nothing.
 *
 * The button's name (aria-label) is its visible words without the hint, as on the phone bar's
 * Search button; assistive tech gets the shortcut from aria-keyshortcuts instead. On a touch
 * screen there is no keyboard to press it with, so the hint is hidden there.
 */

import { useKBar } from 'kbar';
import type { ReactElement } from 'react';

import { usePaletteShortcut } from '@/components/cmd';
import { cn } from '@/lib/utils';

export const PALETTE_HINT_LABEL = 'Jump to…';

const BUTTON_CLASS =
  'inline-flex h-11 items-center gap-2 rounded-full border border-hairline bg-surface-1 px-4 text-body-sm font-medium text-muted-foreground transition-colors duration-(--motion-fast) ease-standard hover:border-hairline-strong hover:text-foreground';
const KBD_CLASS =
  'rounded-sm border border-hairline bg-surface-3 px-1.5 font-mono text-label text-muted-foreground pointer-coarse:hidden';

export function PaletteHint({ className }: { className?: string }): ReactElement {
  const { query } = useKBar();
  const shortcut = usePaletteShortcut();
  return (
    <button
      type="button"
      onClick={() => query.toggle()}
      aria-label={PALETTE_HINT_LABEL}
      aria-keyshortcuts={shortcut.keys}
      className={cn(BUTTON_CLASS, className)}
    >
      {PALETTE_HINT_LABEL}
      <kbd className={KBD_CLASS}>{shortcut.label}</kbd>
    </button>
  );
}
