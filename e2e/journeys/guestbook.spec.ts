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
 * @file /guestbook against the live data, read-only. Nothing here hard-codes a count: each check
 * compares the page with its own header count line ("28 notes · since Oct 2025").
 * - Without JavaScript every message is a tile in the server HTML, as many as the header states
 *   (a trailing '+' there means the safety cap cut the list, and the tiles are the number before
 *   it), and every tile is shown (no pagination, no load-more, nothing waiting for a script).
 * - The wall is cut into years, each once, newest first, whose counts add up to the header's; the
 *   dashed "Your note here" tile is the first tile of the newest year. A one-note year is a heading
 *   on the rule (never a full numeral), and every year's count sits on its line, right after it.
 * - Notes sit by their length, not in a grid of identical boxes: only a sentence (a tile) has a box;
 *   a few words (a sticker) and longer feedback (a quote) have none.
 * - A signature's dot never ends a line ('Anonymous ·' then 'Oct 2025') nor starts one: when the
 *   month wraps under the name the dot is clipped away. No word in a note breaks inside itself at
 *   320px, and no note runs past its box. A word holding an address moves whole to the next line
 *   when it fits there, and breaks only after a dot or a slash, or inside a piece wider than its
 *   whole line; with 200% text at 320px no closing bracket starts a line alone.
 * - Notes a hostile guest could post (rendered through the real row in Node, shown in the page
 *   only, never posted) stay inside a 140px note at 200% text, and each address's closing marks
 *   stay on the line of the character before them.
 * - The next year follows the newest year's notes by more than a row gap and less than two, so a
 *   one-note year leaves no screen-wide pause; Sign in is 44px tall under a finger, 36px with a
 *   mouse.
 * - The wall reads left to right, then down, in the DOM's newest-first order (so Tab and a screen
 *   reader follow what the eye reads), at a desktop and a phone width, with JavaScript off too.
 * - None of the page's own text is a literal entity (&#039;, &amp;, &quot;, &lt;, &gt;). The rows
 *   hold visitors' words as typed, which may say `&amp;`, so they are checked only for what text
 *   escaped twice shows and nobody types (&#039;, &amp;amp;, &amp;#039;...). The loader's legacy
 *   decoding is unit-tested with controlled records, in entities.test.ts and
 *   messages-loader.test.ts.
 * - A visitor who does not sign in triggers no Firebase Auth or identity request and gets no
 *   auth iframe, on a phone (390, mobile user agent) or a desktop (1280); pressing Sign in loads
 *   Firebase then, and only then offers the providers.
 * - The page never scrolls sideways at 390 or 1280, has one h1, and its text is the refined type:
 *   nothing visible under 12px, nothing set in capitals.
 *
 * The real guestbook is public production data, so every context here aborts any request that is
 * not GET or HEAD, and every request to a Firebase Auth or identity host (recorded first, so the
 * checks see the attempt; analytics beacons are aborted without being counted). On a dev server
 * the hot-reload socket gets a silent stand-in, so no reload lands mid-check. No test signs in or
 * posts.
 */

import {
  type Browser,
  type BrowserContext,
  devices,
  expect,
  type Locator,
  type Page,
  test,
} from '@playwright/test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { MessageRow } from '@/app/(routes)/(main)/(personal)/guestbook/_components/message-row';
import { getTargetUrl } from '../fixtures/base';

const PATH = '/guestbook';
const MAIN = 'main#main-content';
const ROW = 'li[data-message-row]';
/** The header's count line (a Folio Byline): "28 notes · since Oct 2025". */
const COUNT_LINE = 'header [data-byline]';
const NOTES = 'section[data-guestbook-notes]';
const CHAPTER = `${NOTES} section[data-chapter]`;
/** A streamed segment not revealed yet, or a skeleton marked busy (shell-grid.spec.ts). */
const PENDING_CONTENT = 'div[hidden][id^="S:"], main [aria-busy="true"]';
const MIN_TEXT_PX = 12;
/** The hosts Firebase Auth and Google sign-in talk to, and the project's auth domain. */
const AUTH_HOSTS =
  /(^|\.)(identitytoolkit\.googleapis\.com|securetoken\.googleapis\.com|apis\.google\.com|accounts\.google\.com|firebaseapp\.com|firestore\.googleapis\.com)$/;
/**
 * Analytics beacons (POSTs to Google Analytics): aborted like every write, but not counted as the
 * page trying to write, since they leave on a timer whatever the test does.
 */
const ANALYTICS = (url: URL): boolean =>
  /(^|\.)(google-analytics\.com|googletagmanager\.com)$/.test(url.hostname) ||
  (/(^|\.)google\.com$/.test(url.hostname) && url.pathname.startsWith('/g/collect'));
/** The dev server's hot-reload socket (production has none). */
const DEV_RELOAD_SOCKET = /\/_next\/.*hmr/;
/** What a dev server sends on every edit; dropped, so another agent's edit reloads nothing. */
const DEV_RELOAD_MESSAGE =
  /^\{"(?:action|type)":"(reloadPage|turbopack-message|building|built|serverComponentChanges)"/;
const ENTITY = /&(#0?39|amp|quot|lt|gt);/;
/**
 * What text escaped once too often shows (escapeHtml back in the JSX: "It&#039;s", "&amp;amp;").
 * Nobody types it, so it fails on rows that hold visitors' words, where ENTITY can't be used.
 */
const DOUBLE_ESCAPED = /&#0?39;|&amp;(#0?39|amp|quot|lt|gt);/;

type Viewport = 'phone' | 'desktop';

const CONTEXTS: Record<Viewport, Parameters<Browser['newContext']>[0]> = {
  phone: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } },
  desktop: { viewport: { width: 1280, height: 800 } },
};

interface Guarded {
  readonly context: BrowserContext;
  readonly page: Page;
  /** Requests to an auth or identity host, aborted. */
  readonly authRequests: string[];
  /** Requests that were not GET or HEAD, aborted. */
  readonly writes: string[];
}

/** A context that can only read: writes and auth hosts are aborted (and recorded). */
/**
 * A dev server (the lab) reloads every open page on every edit, and other edits land while these
 * checks run. By default its socket gets a silent stand-in: the page then keeps the server's HTML
 * and CSS, all the layout checks need, and never reloads under them. A check that needs the page
 * hydrated (signing in, what loads) gets the real socket without the reload messages; such a page
 * may still reload once as it connects, so those checks wait in ways that survive it.
 */
async function devSocket(context: BrowserContext, hydrate: boolean): Promise<void> {
  await context.routeWebSocket(DEV_RELOAD_SOCKET, (socket) => {
    if (!hydrate) return;
    const server = socket.connectToServer();
    server.onMessage((message) => {
      if (!DEV_RELOAD_MESSAGE.test(String(message))) socket.send(message);
    });
  });
}

async function guardedContext(
  browser: Browser,
  viewport: Viewport,
  javaScriptEnabled = true,
  size?: { readonly width: number; readonly height: number },
  hydrate = false,
): Promise<Guarded> {
  const options = { ...CONTEXTS[viewport], javaScriptEnabled };
  const context = await browser.newContext(size ? { ...options, viewport: size } : options);
  const authRequests: string[] = [];
  const writes: string[] = [];
  await devSocket(context, hydrate);
  await context.route('**/*', (route) => {
    const request = route.request();
    const url = request.url();
    if (!['GET', 'HEAD'].includes(request.method())) {
      if (!(/^https?:/.test(url) && ANALYTICS(new URL(url)))) {
        writes.push(`${request.method()} ${url}`);
      }
      return route.abort();
    }
    if (/^https?:/.test(url) && AUTH_HOSTS.test(new URL(url).hostname)) {
      authRequests.push(url);
      return route.abort();
    }
    return route.continue();
  });
  return { context, page: await context.newPage(), authRequests, writes };
}

async function open(page: Page): Promise<Locator> {
  const response = await page.goto(`${getTargetUrl()}${PATH}`);
  expect(response?.status()).toBe(200);
  const main = page.locator(MAIN);
  await expect(main).toBeVisible();
  await expect(page.locator(PENDING_CONTENT)).toHaveCount(0);
  // Polled, so a dev server's one reload while connecting (see devSocket) can't throw here.
  await expect
    .poll(() => page.evaluate(() => document.fonts.status).catch(() => 'reloading'))
    .toBe('loaded');
  return main;
}

/** A count at the start of a line: "1,300 notes" is 1300; '+' (the safety cap) is dropped. */
const leadingCount = (text: string): number | null => {
  const match = /^([\d,]+)\+? notes?\b/.exec(text.replace(/\s+/g, ' ').trim());
  return match?.[1] ? Number(match[1].replaceAll(',', '')) : null;
};

/**
 * The header's note count, as a number (fails when the list could not load). A trailing '+'
 * means the safety cap cut the list; the tiles shown are then the number before it.
 */
async function statedCount(main: Locator): Promise<number> {
  // The first byline in a header is the page's; each year chapter's opener has its own after it.
  const count = leadingCount((await main.locator(COUNT_LINE).first().textContent()) ?? '');
  expect(count, 'the header states a count (the list loaded)').not.toBeNull();
  return count ?? 0;
}

/**
 * Where each wall breaks reading order: a tile (in DOM order) that is neither to the right of the
 * one before it on the same row nor on a lower row.
 */
function readingOrderBreaks(main: Locator): Promise<string[]> {
  return main.evaluate((root, notes) => {
    const breaks: string[] = [];
    for (const wall of root.querySelectorAll(`${notes} ol`)) {
      const boxes = Array.from(wall.children).map((tile) => tile.getBoundingClientRect());
      boxes.forEach((box, index) => {
        const before = boxes[index - 1];
        if (!before) return;
        const sameRow = Math.abs(box.top - before.top) < 1;
        const inOrder = sameRow ? box.left > before.left : box.top >= before.bottom - 1;
        if (!inOrder) breaks.push(`tile ${index}: ${Math.round(box.left)},${Math.round(box.top)}`);
      });
    }
    return breaks;
  }, NOTES);
}

/** Each year's size and whether its count sits on its line, right after the year. */
function chapterHeads(main: Locator) {
  return main.locator(CHAPTER).evaluateAll((sections) =>
    sections.map((section) => {
      const year = section.querySelector('h2')?.getBoundingClientRect();
      const count = section.querySelector('header [data-byline]')?.getBoundingClientRect();
      const besideYear =
        !!year &&
        !!count &&
        count.left >= year.right &&
        count.top < year.bottom &&
        count.bottom > year.top;
      return {
        title: section.querySelector('h2')?.textContent ?? '',
        size: section.getAttribute('data-chapter'),
        notes: section.querySelectorAll('li[data-message-row]').length,
        besideYear,
      };
    }),
  );
}

/** Each note's treatment and whether it draws a box (a fill or a border). */
function noteBoxes(main: Locator) {
  return main.locator(ROW).evaluateAll((rows) =>
    rows.map((row) => {
      const style = getComputedStyle(row);
      const filled =
        style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent';
      return {
        treatment: row.getAttribute('data-treatment'),
        boxed: filled || Number.parseFloat(style.borderTopWidth) > 0,
      };
    }),
  );
}

/** Signatures whose dot and month do not sit on one line. */
function splitSignatures(main: Locator): Promise<string[]> {
  return main.locator(`${ROW} time`).evaluateAll((times) =>
    times.flatMap((time) => {
      const group = time.parentElement;
      if (!group) return [];
      const tops = new Set(Array.from(group.getClientRects(), (rect) => Math.round(rect.top)));
      return tops.size > 1 ? [group.closest('p')?.textContent ?? ''] : [];
    }),
  );
}

/**
 * Signatures whose dot is wrong for where the month sits: shown at the start of a line (the month
 * wrapped under the name), or gone while the month still follows the name on its line. A dropped
 * dot must be clipped off the line, so nothing is painted or hit where it sits.
 */
function misplacedDots(main: Locator): Promise<string[]> {
  return main.locator(`${ROW} > p:last-child`).evaluateAll((signatures) =>
    signatures.flatMap((signature) => {
      const dot = signature.querySelector('[aria-hidden="true"]');
      const month = dot?.parentElement;
      const name = month?.parentElement?.firstElementChild;
      if (!dot || !month || !name) return [];
      const wrapped = month.getBoundingClientRect().top >= name.getBoundingClientRect().bottom - 1;
      const shown =
        dot.getBoundingClientRect().right > signature.getBoundingClientRect().left + 0.5;
      if (shown === wrapped) return [signature.textContent ?? ''];
      if (!wrapped) return [];
      signature.scrollIntoView({ block: 'center' });
      const box = dot.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return hit && dot.contains(hit) ? [`${signature.textContent ?? ''} (dot painted)`] : [];
    }),
  );
}

/** Closing brackets and punctuation in the notes that start a line apart from their word. */
function strandedClosers(main: Locator): Promise<string[]> {
  return main.locator(`${ROW} > p:first-of-type`).evaluateAll((notes) => {
    const stranded: string[] = [];
    const range = document.createRange();
    for (const note of notes) {
      const chars: { readonly char: string; readonly top: number | null }[] = [];
      const walker = document.createTreeWalker(note, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent ?? '';
        for (let index = 0; index < text.length; index++) {
          range.setStart(node, index);
          range.setEnd(node, index + 1);
          const rect = Array.from(range.getClientRects()).find((box) => box.width > 0);
          chars.push({ char: text.charAt(index), top: rect ? Math.round(rect.top) : null });
        }
      }
      chars.forEach(({ char, top }, index) => {
        const before = chars[index - 1];
        if (!before || !/[)\]}.,;:!?]/.test(char) || /\s/.test(before.char)) return;
        if (top !== null && before.top !== null && top !== before.top) {
          stranded.push(
            chars
              .slice(Math.max(0, index - 16), index + 1)
              .map((c) => c.char)
              .join(''),
          );
        }
      });
    }
    return stranded;
  });
}

/**
 * The room between the newest year's notes and the next year's heading, against the wall's own
 * row gap, so the years read as one wall rather than a screen apart.
 */
function yearGap(main: Locator) {
  return main.locator(CHAPTER).evaluateAll((sections) => {
    const [first, second] = sections;
    const wall = first?.querySelector('ol');
    const heading = second?.querySelector('h2');
    if (!(wall && heading)) return null;
    const bottom = Math.max(
      ...Array.from(wall.children, (note) => note.getBoundingClientRect().bottom),
    );
    return {
      gap: heading.getBoundingClientRect().top - bottom,
      rowGap: Number.parseFloat(getComputedStyle(wall).rowGap),
    };
  });
}

/**
 * Words in the notes broken inside themselves across two lines, read across the note's text nodes
 * (an address's held runs are nodes of their own). An address may break after a dot or a slash,
 * a run of emoji between two of them (browsers may break there), and a piece wider than its whole
 * line wherever it must, since nothing may run past the note ('contrastchecker/)' is 2px wider
 * than a 320px phone's line at 200% text).
 */
function brokenWords(main: Locator): Promise<string[]> {
  return main.locator(`${ROW} > p:first-of-type`).evaluateAll((notes) => {
    const broken: string[] = [];
    const range = document.createRange();
    for (const note of notes) {
      const chars: {
        readonly char: string;
        readonly top: number | null;
        readonly width: number;
      }[] = [];
      const walker = document.createTreeWalker(note, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent ?? '';
        for (let index = 0; index < text.length; index++) {
          range.setStart(node, index);
          range.setEnd(node, index + 1);
          const rect = Array.from(range.getClientRects()).find((box) => box.width > 0);
          const top = rect ? Math.round(rect.top) : null;
          chars.push({ char: text.charAt(index), top, width: rect?.width ?? 0 });
        }
      }
      const charAt = (at: number): string => chars[at]?.char ?? ' ';
      const isSpace = (at: number): boolean => /\s/.test(charAt(at));
      const isCut = (at: number): boolean => /[./]/.test(charAt(at));
      chars.forEach(({ top }, index) => {
        const before = chars[index - 1];
        if (!before || top === null || before.top === null || top === before.top) return;
        if (isSpace(index) || isSpace(index - 1) || isCut(index - 1)) return;
        let start = index - 1;
        while (start > 0 && !isSpace(start - 1)) start--;
        let end = index;
        while (end < chars.length - 1 && !isSpace(end + 1)) end++;
        const word = chars.slice(start, end + 1).map((c) => c.char);
        if (/^(?:\p{Extended_Pictographic}|\u200d|\ufe0f)+$/u.test(word.join(''))) return;
        // The piece around the break: between dots and slashes, with the marks closing the word.
        let closing = end + 1;
        while (closing > start && /[/)\]}>.,;:!?'"]/.test(charAt(closing - 1))) closing--;
        let from = index - 1;
        while (from > start && !isCut(from - 1)) from--;
        let to = index;
        while (to < end && (!isCut(to) || to + 1 >= closing)) to++;
        const width = chars.slice(from, to + 1).reduce((sum, c) => sum + c.width, 0);
        if (width <= note.clientWidth) broken.push(word.join(''));
      });
    }
    return broken;
  });
}

/** Notes whose text runs past their box, or that run past their wall: none may. */
function overflowingNotes(main: Locator): Promise<string[]> {
  return main.locator(ROW).evaluateAll((rows) => {
    const over: string[] = [];
    const range = document.createRange();
    for (const row of rows) {
      const note = row.querySelector(':scope > p');
      const wall = row.parentElement?.getBoundingClientRect();
      if (!(note && wall)) continue;
      const box = note.getBoundingClientRect();
      let past = 0;
      const walker = document.createTreeWalker(note, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent ?? '';
        for (let index = 0; index < text.length; index++) {
          if (/\s/.test(text.charAt(index))) continue;
          range.setStart(node, index);
          range.setEnd(node, index + 1);
          for (const rect of Array.from(range.getClientRects())) {
            past = Math.max(past, rect.right - box.right, box.left - rect.left);
          }
        }
      }
      const own = row.getBoundingClientRect();
      const outside = Math.max(own.right - wall.right, wall.left - own.left);
      if (past > 0.5 || note.scrollWidth > note.clientWidth || outside > 0.5) {
        over.push(
          `${(note.textContent ?? '').slice(0, 40)}: ${Math.round(Math.max(past, outside))}px`,
        );
      }
    }
    return over;
  });
}

/**
 * Words holding an address split across lines although they would fit on one: such a word moves
 * whole to the next line, and breaks at its dots and slashes only when it is wider than the note
 * ('Just use my LinkTree (http://' / 'linktr.ee/mikeodnis)' at 1440 before).
 */
function splitAddresses(main: Locator): Promise<string[]> {
  return main.locator(`${ROW} > p:first-of-type > span`).evaluateAll((words) => {
    const range = document.createRange();
    return words
      .filter((word) => {
        const note = word.parentElement;
        const text = word.textContent ?? '';
        const tops = new Set<number>();
        let width = 0;
        const walker = document.createTreeWalker(word, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          for (let index = 0; index < (node.textContent ?? '').length; index++) {
            range.setStart(node, index);
            range.setEnd(node, index + 1);
            const rect = Array.from(range.getClientRects()).find((box) => box.width > 0);
            if (!rect) continue;
            tops.add(Math.round(rect.top));
            width += rect.width;
          }
        }
        return note !== null && text !== '' && tops.size > 1 && width < note.clientWidth - 1;
      })
      .map((word) => word.textContent ?? '');
  });
}

/**
 * Notes a guest could post, each ending its address in brackets or punctuation. They are rendered
 * through the real row in Node and shown in the page only (never posted), each note 140px wide.
 */
const HOSTILE_NOTES = [
  'Saw you on (https://x.com/someone/status/1851234567890123456)',
  'https://youtube.com/watch?v=dQw4w9WgXcQ!',
  `https://example.com/${'a'.repeat(256)}))!!`,
  'great site \ud83c\udf89\ud83c\udf89\ud83c\udf89\ud83c\udf89\ud83c\udf89\ud83c\udf89\ud83c\udf89\ud83c\udf89\ud83c\udf89\ud83c\udf89 (https://example.com/\ud83c\udf89\ud83c\udf89\ud83c\udf89\ud83c\udf89\ud83c\udf89\ud83c\udf89\ud83c\udf89\ud83c\udf89)',
  'family (https://example.com/\ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d\udc67\u200d\ud83d\udc66\ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d\udc67\u200d\ud83d\udc66\ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d\udc67\u200d\ud83d\udc66)',
  'from (https://example.com/\ud83c\uddfa\ud83c\uddf8\ud83c\uddeb\ud83c\uddf7\ud83c\uddef\ud83c\uddf5\ud83c\udde7\ud83c\uddf7\ud83c\uddee\ud83c\uddf3)!',
  '\u0645\u0648\u0642\u0639 \u0631\u0627\u0626\u0639 \u062c\u062f\u0627\u060c \u0632\u0648\u0631\u0648\u0627 (https://example.com/\u0645\u0631\u062d\u0628\u0627/\u0628\u0643\u0645/\u0641\u064a/\u0645\u0648\u0642\u0639\u064a) \u0634\u0643\u0631\u0627',
  '\u05d0\u05ea\u05e8 \u05de\u05e2\u05d5\u05dc\u05d4 (https://example.co.il/\u05e9\u05dc\u05d5\u05dd/\u05e2\u05d5\u05dc\u05dd)!',
] as const;
const HOSTILE_WIDTH = 140;

const hostileRow = (text: string, index: number): string =>
  renderToStaticMarkup(
    createElement(MessageRow, {
      message: {
        id: `hostile-${index}`,
        authorName: 'A guest',
        message: text,
        createdAt: '2025-10-27T09:19:00.000Z',
      },
    }),
  );

/**
 * The hostile rows shown in a wall of their own above the real one, each note pinned to `width`:
 * per note, its text, how far anything runs past its box, and the held runs (an address's last
 * character with its closing marks) that wrapped across two lines.
 */
function showHostile(main: Locator, rows: readonly string[], width: number) {
  return main.evaluate(
    (root, { rows, width }) => {
      const wall = root.querySelector('[data-guestbook-notes] ol');
      const host = document.createElement('ol');
      host.className = wall?.className ?? '';
      wall?.before(host);
      host.innerHTML = rows.join('');
      const range = document.createRange();
      return Array.from(host.children, (row) => {
        (row as HTMLElement).style.cssText = `flex:0 0 ${width}px;max-width:${width}px`;
        const note = row.querySelector(':scope > p') as HTMLElement;
        const box = note.getBoundingClientRect();
        range.selectNodeContents(note);
        const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0);
        const past = Math.max(
          0,
          ...rects.map((r) => Math.max(r.right - box.right, box.left - r.left)),
        );
        const held = Array.from(note.querySelectorAll('span span'), (span) => {
          range.selectNodeContents(span);
          const tops = new Set(Array.from(range.getClientRects(), (r) => Math.round(r.top)));
          return { text: span.textContent ?? '', lines: tops.size };
        });
        return {
          text: note.textContent ?? '',
          past: Math.round(Math.max(past, note.scrollWidth - note.clientWidth)),
          last: held.at(-1)?.text ?? '',
          wrappedHolds: held.filter((run) => run.lines > 1).map((run) => run.text),
        };
      });
    },
    { rows, width },
  );
}

/** Main's text without the message rows, which hold visitors' words exactly as typed. */
function ownText(main: Locator): Promise<string> {
  return main.evaluate((root, row) => {
    const copy = root.cloneNode(true) as Element;
    for (const message of copy.querySelectorAll(row)) message.remove();
    return copy.textContent ?? '';
  }, ROW);
}

/** Visible text in main under 12px, or set in capitals (sr-only text is skipped). */
function textOffenders(main: Locator): Promise<string[]> {
  return main.evaluate((root, minimum) => {
    const found: string[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
      const element = node.parentElement;
      const shown = element?.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
      if (text === '' || !element || !shown) continue;
      const box = element.getBoundingClientRect();
      if (box.width <= 1 && box.height <= 1) continue;
      const style = getComputedStyle(element);
      if (Number.parseFloat(style.fontSize) < minimum - 0.01) {
        found.push(`${text.slice(0, 40)}: ${style.fontSize}`);
      }
      if (style.textTransform === 'uppercase') found.push(`${text.slice(0, 40)}: uppercase`);
    }
    return found;
  }, MIN_TEXT_PX);
}

test.describe('/guestbook', () => {
  test('without JavaScript, every message is a shown tile, as many as the header states', async ({
    browser,
  }) => {
    const { context, page, writes } = await guardedContext(browser, 'desktop', false);
    const main = await open(page);
    const count = await statedCount(main);
    const rows = main.locator(ROW);

    expect(count).toBeGreaterThan(0);
    await expect(rows).toHaveCount(count);
    expect(await rows.evaluateAll((all) => all.filter((row) => row.checkVisibility()).length)).toBe(
      count,
    );
    await expect(main.getByText(/load more/i)).toHaveCount(0);
    expect(writes).toEqual([]);
    await context.close();
  });

  for (const viewport of ['phone', 'desktop'] as const) {
    test(`${viewport}: no Firebase Auth request and no auth iframe on load`, async ({
      browser,
    }) => {
      const { context, page, authRequests, writes } = await guardedContext(
        browser,
        viewport,
        true,
        undefined,
        true,
      );
      await open(page);
      await page.waitForLoadState('networkidle');

      const frames = page.frames().filter((frame) => frame !== page.mainFrame());
      expect(authRequests).toEqual([]);
      expect(frames.map((frame) => frame.url())).toEqual([]);
      expect(writes).toEqual([]);
      await context.close();
    });

    test(`${viewport}: no sideways scroll, one h1, refined type, no literal entities`, async ({
      browser,
    }) => {
      const { context, page } = await guardedContext(browser, viewport);
      const main = await open(page);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      expect(await page.locator('h1').count()).toBe(1);
      await expect(main.locator('h1')).toHaveText('Guestbook');
      expect(await textOffenders(main)).toEqual([]);
      // All of main's own text, screen-reader-only words included: none of it may be an entity.
      // A message may legitimately say `&amp;` (shown as typed), so the rows are left out of that,
      // and are only checked for the marks of text escaped twice.
      expect(await ownText(main)).not.toMatch(ENTITY);
      const rows = await main.locator(ROW).allTextContents();
      expect(rows.filter((text) => DOUBLE_ESCAPED.test(text))).toEqual([]);
      await context.close();
    });
  }

  test('the wall is cut into years, newest first, adding up to the header count', async ({
    browser,
  }) => {
    const { context, page, writes } = await guardedContext(browser, 'desktop');
    const main = await open(page);
    const count = await statedCount(main);
    const chapters = await main.locator(CHAPTER).evaluateAll((sections) =>
      sections.map((section) => ({
        title: section.querySelector('h2')?.textContent ?? '',
        byline: section.querySelector('[data-byline]')?.textContent ?? '',
        tiles: section.querySelectorAll('li[data-message-row]').length,
      })),
    );
    const years = chapters.map((chapter) => Number(chapter.title));

    expect(years.every((year) => Number.isInteger(year) && year > 2000)).toBe(true);
    expect(years).toEqual([...years].sort((a, b) => b - a));
    expect(new Set(years).size).toBe(years.length);
    for (const chapter of chapters) expect(leadingCount(chapter.byline)).toBe(chapter.tiles);
    expect(chapters.reduce((sum, chapter) => sum + chapter.tiles, 0)).toBe(count);
    // A one-note year is a heading on the rule, and every count sits right after its year.
    for (const head of await chapterHeads(main)) {
      if (head.notes === 1) expect(head.size, `${head.title} holds one note`).toBe('inline');
      expect(head.besideYear, `${head.title}'s count sits beside it`).toBe(true);
    }
    // The compose tile opens the newest year's wall, and there is one.
    const firstWall = main.locator(`${CHAPTER} ol`).first();
    await expect(firstWall.locator(':scope > :first-child[data-compose-tile]')).toHaveCount(1);
    await expect(main.locator('[data-compose-tile]')).toHaveCount(1);
    await expect(
      firstWall.getByRole('heading', { level: 3, name: 'Your note here' }),
    ).toBeVisible();
    expect(writes).toEqual([]);
    await context.close();
  });

  for (const [viewport, javaScriptEnabled] of [
    ['desktop', true],
    ['phone', true],
    ['phone', false],
  ] as const) {
    test(`${viewport}${javaScriptEnabled ? '' : ' without JavaScript'}: the wall reads left to right, then down`, async ({
      browser,
    }) => {
      const { context, page, writes } = await guardedContext(browser, viewport, javaScriptEnabled);
      const main = await open(page);

      expect(await main.locator(ROW).count()).toBeGreaterThan(1);
      expect(await readingOrderBreaks(main)).toEqual([]);
      expect(writes).toEqual([]);
      await context.close();
    });
  }

  test('notes sit by their length: only a sentence has a box, stickers and quotes have none', async ({
    browser,
  }) => {
    const { context, page, writes } = await guardedContext(browser, 'desktop');
    const main = await open(page);
    const notes = await noteBoxes(main);

    expect(new Set(notes.map((note) => note.treatment)).size).toBeGreaterThan(1);
    for (const note of notes) expect(note.boxed).toBe(note.treatment === 'tile');
    expect(writes).toEqual([]);
    await context.close();
  });

  for (const [viewport, width] of [
    ['desktop', 1280],
    ['phone', 390],
    ['phone', 320],
  ] as const) {
    test(`${viewport} at ${width}px: no signature ends a line with its dot, no word breaks inside`, async ({
      browser,
    }) => {
      const size = { width, height: viewport === 'phone' ? 844 : 800 };
      const { context, page, writes } = await guardedContext(browser, viewport, true, size);
      const main = await open(page);

      expect(await splitSignatures(main)).toEqual([]);
      expect(await misplacedDots(main)).toEqual([]);
      expect(await brokenWords(main)).toEqual([]);
      expect(await overflowingNotes(main)).toEqual([]);
      expect(await splitAddresses(main)).toEqual([]);
      expect(writes).toEqual([]);
      await context.close();
    });
  }

  test('phone at 320px with 200% text: no bracket starts a line alone, no dot starts one', async ({
    browser,
  }) => {
    const { context, page, writes } = await guardedContext(browser, 'phone', true, {
      width: 320,
      height: 640,
    });
    // The browser's own text size (a root font of 32px), as a reader who enlarges text sets it.
    const cdp = await context.newCDPSession(page);
    await cdp.send('Page.setFontSizes', { fontSizes: { standard: 32, fixed: 26 } });
    const main = await open(page);

    expect(await strandedClosers(main)).toEqual([]);
    expect(await misplacedDots(main)).toEqual([]);
    expect(await splitSignatures(main)).toEqual([]);
    expect(await brokenWords(main)).toEqual([]);
    expect(await overflowingNotes(main)).toEqual([]);
    expect(await splitAddresses(main)).toEqual([]);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    expect(writes).toEqual([]);
    await context.close();
  });

  for (const [viewport, width] of [
    ['desktop', 1440],
    ['phone', 390],
  ] as const) {
    test(`${viewport} at ${width}px with 200% text: hostile notes stay inside a 140px note`, async ({
      browser,
    }) => {
      const size = { width, height: viewport === 'phone' ? 844 : 900 };
      const { context, page, writes } = await guardedContext(browser, viewport, true, size);
      const cdp = await context.newCDPSession(page);
      await cdp.send('Page.setFontSizes', { fontSizes: { standard: 32, fixed: 26 } });
      const main = await open(page);
      const shown = await showHostile(main, HOSTILE_NOTES.map(hostileRow), HOSTILE_WIDTH);

      expect(shown.map((note) => note.text)).toEqual([...HOSTILE_NOTES]);
      expect(shown.filter((note) => note.past > 0.5)).toEqual([]);
      // Each address's closing marks stay with the character before them, on one line.
      expect(shown.map((note) => note.last)).toEqual([
        '6)',
        'Q!',
        'a))!!',
        '🎉)',
        '👨‍👩‍👧‍👦)',
        '🇮🇳)!',
        'ي)',
        'ם)!',
      ]);
      expect(shown.flatMap((note) => note.wrappedHolds)).toEqual([]);
      expect(writes).toEqual([]);
      await context.close();
    });
  }

  for (const viewport of ['desktop', 'phone'] as const) {
    test(`${viewport}: the next year follows the notes above it as part of one wall`, async ({
      browser,
    }) => {
      const { context, page, writes } = await guardedContext(browser, viewport);
      const main = await open(page);
      const measured = await yearGap(main);

      test.skip(measured === null, 'One year only: there is no gap between years.');
      const { gap = 0, rowGap = 0 } = measured ?? {};
      // More room than between two rows of notes, so the year still reads as a new chapter, but
      // less than two rows' worth: no screen-wide pause after a short year.
      expect(gap).toBeGreaterThan(rowGap);
      expect(gap).toBeLessThan(2 * rowGap);
      expect(writes).toEqual([]);
      await context.close();
    });
  }

  test('Sign in is a 44px target under a finger, and the usual 36px under a mouse', async ({
    browser,
  }) => {
    const heights: Record<string, number> = {};
    for (const viewport of ['phone', 'desktop'] as const) {
      const { context, page, writes } = await guardedContext(browser, viewport);
      const main = await open(page);
      const box = await main.getByRole('button', { name: 'Sign in' }).boundingBox();
      heights[viewport] = Math.round(box?.height ?? 0);
      expect(writes).toEqual([]);
      await context.close();
    }

    expect(heights.phone).toBeGreaterThanOrEqual(44);
    expect(heights.desktop).toBe(36);
  });

  test('pressing Sign in loads Firebase then, and offers the providers', async ({ browser }) => {
    const { context, page, writes } = await guardedContext(
      browser,
      'desktop',
      true,
      undefined,
      true,
    );
    const main = await open(page);
    const scripts: string[] = [];
    page.on('request', (request) => {
      if (request.resourceType() === 'script') scripts.push(request.url());
    });
    const google = main.getByRole('button', { name: 'Continue with Google' });

    // Pressed again only if a dev server's reload put the plain tile back before the choices came.
    await expect(async () => {
      if (!(await google.isVisible())) {
        await main.getByRole('button', { name: 'Sign in' }).click({ timeout: 5_000 });
      }
      await expect(google).toBeVisible({ timeout: 10_000 });
    }).toPass({ timeout: 60_000 });
    await expect(main.getByRole('button', { name: 'Continue with GitHub' })).toBeVisible();
    await expect(main.getByRole('button', { name: 'Continue as guest' })).toBeVisible();
    expect(scripts.length, 'the Firebase chunk loads on the press').toBeGreaterThan(0);
    expect(writes).toEqual([]);
    await context.close();
  });
});
