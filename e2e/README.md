<!--
  Copyright (c) 2026 Mike Odnis

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all
  copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.
-->

# E2E Tests (Playwright)

End-to-end tests using Playwright for real browser testing.

## Directory Structure

```
e2e/
├── accessibility/        # WCAG accessibility tests
│   └── a11y.spec.ts      # Keyboard nav, ARIA, semantic HTML
├── journeys/             # User journey tests
│   ├── home-bento.spec.ts
│   ├── navigation.spec.ts
│   ├── guestbook.spec.ts
│   ├── dark-mode.spec.ts
│   ├── projects.spec.ts
│   ├── experience.spec.ts
│   ├── media.spec.ts
│   └── stats.spec.ts
├── performance/          # Performance tests
│   └── perf.spec.ts      # Load times, Core Web Vitals, caching
├── seo/                  # SEO tests
│   ├── seo.spec.ts       # Meta tags, OG, structured data
│   └── server-render.spec.ts
├── visual/               # Visual regression tests
│   ├── homepage.spec.ts
│   └── shell-grid.spec.ts
├── fixtures/             # Playwright fixtures
│   ├── auth.setup.ts     # Auth state setup
│   ├── base.ts           # Extended test fixtures
│   └── home-bento.ts     # Home bento selectors, settle wait and masonry measure
└── README.md
```

## Test Categories

### Journeys (`e2e/journeys/`)

User journey tests that verify end-to-end flows:

- **home-bento.spec.ts** - The home bento (Waterfall masonry): layout at 320 to 1440 px, the
  masonry's spans, estimates and first paint, links, keyboard, motion, console, and the HTML
  without JavaScript (see [The home bento](#the-home-bento) below)
- **navigation.spec.ts** - Site navigation, routing, back/forward
- **guestbook.spec.ts** - Guestbook viewing and posting
- **dark-mode.spec.ts** - Theme toggle, persistence
- **projects.spec.ts** - Projects page, modals, filtering
- **experience.spec.ts** - Experience timeline, detail modals
- **media.spec.ts** - Media page with tabs (videos, talks, blogs, podcasts)
- **stats.spec.ts** - Stats dashboard, API integrations

### Accessibility (`e2e/accessibility/`)

WCAG compliance tests:

- Keyboard navigation
- Focus indicators
- Skip links
- Semantic HTML & landmarks
- Image alt text
- ARIA roles & properties
- Touch targets

### Performance (`e2e/performance/`)

Performance and optimization tests:

- Page load times
- Core Web Vitals indicators
- Resource loading order
- Image optimization
- Caching headers
- JavaScript performance
- Font loading

### SEO (`e2e/seo/`)

Search engine optimization tests:

- Meta tags (title, description, viewport)
- Open Graph tags
- Twitter Card tags
- Canonical URLs
- Structured data (JSON-LD)
- robots.txt & sitemap.xml
- Heading hierarchy
- Link attributes

### Visual (`e2e/visual/`)

Visual regression and responsive tests:

- Homepage rendering
- Responsive design (mobile, tablet, desktop)
- Content visibility

The screenshot tests in `homepage.spec.ts` are attach-only until baselines are committed: the
repository has none yet, so each screenshot is attached to the test report for review and compared
with nothing, and these tests cannot fail on how the page looks. A screenshot is compared once its
baseline file exists. Create or refresh baselines on purpose, review the diff, then commit the
`e2e/visual/homepage.spec.ts-snapshots/` folder:

```bash
UPDATE_VISUAL_BASELINES=1 bunx playwright test e2e/visual/homepage.spec.ts \
  --project=chromium --update-snapshots
```

Baselines are per browser project and platform, and hold only for the data they were taken with:
a baseline taken with every API key fails on a server without them, where the tiles that need one
show their error states. The screenshots mask what changes on its own: the now playing, status,
GitHub and project slots (the project is the owner's latest work when his commits pick it, with a
'committed …' line), the footer's status badge, text marked `data-dated` (the 'Recently at'
place's when line, worded from today's date) and any stale tile's 'as of …' line. A masked slot
keeps its box, so the masonry's placement is still compared; a tile whose data changes height can
move later tiles, even to another lane, so review such a diff.

## The home bento

`journeys/home-bento.spec.ts` checks the Waterfall masonry against itself, never against fixed
heights. No check needs API keys, but a run without them checks less: the tiles that need a key
show their designed error states, the estimate and first paint checks compare only the tiles that
show their reference content (and name the rest in test annotations), and the equaliser check
skips unless something plays. A tile marks every other state by the tiles' state contract:
`data-state` of `loading`, `error`, `empty` or `stale`, `data-stale` where a stale line shows, or
`aria-busy="true"`. Slots are found by `data-bento-slot`, in priority order: hero, now, status,
leet, type, gh, proj, place, role, strip.

| Check         | Widths                                                       | What fails it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Layout        | 320, 375, 600, 700, 768, 1024, 1280, 1440                    | Sideways overflow (against `document.body.clientWidth`); overlapping slots or tiles; a tile more than 24 px taller than its content; a hero that is not the largest tile, or that spans other than two lanes from a 40rem bento; a slot's top more than 32 px above the previous slot's; visible text under 12 px; not exactly one h1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Masonry spans | the same                                                     | With JavaScript, a slot whose `grid-row` span is more than one row from its measured height: the script that measures the slots is broken                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Estimates     | 375, 390, 412, 500, 600, 700, 720, 768, 820, 900, 1024, 1440 | Without JavaScript, a slot in one lane that reserves more than 16 px more or less than its height with JavaScript, or a slot across every lane that reserves more than 16 px above it (less is fine: an underestimate grows only its own rows). Only slots whose tile shows its reference content with JavaScript are compared, and not a lane slot that one of the others, or a slot in an error, empty or stale state without JavaScript, sent to a lane of another width; an annotation names them. The project at md and md-wide (`BENTO_ESTIMATE_GAPS`: its 2:1 cover grows with its lane) is held to its measured range instead, within 2 px (271.2 to 310.9 px at md, 311.1 to 380.8 px at md-wide), and so is what its rows reserve: outside it, it fails; inside it, a miss of more than 16 px (about 20 px at 700 px) is an annotation |
| First paint   | the same                                                     | Without JavaScript, a slot whose top is more than 16 px from its top with JavaScript. Runs only when every slot shows its reference content with JavaScript and none is in an error, empty or stale state without it (a skeleton counts as its tile there); otherwise an annotation names the slots that stopped it. At md and md-wide the slots after the project (place, roles, the site index) may move up to 48 px, whether or not the project is off there (the worst measured is 40.8 px: the site index at a 799 px bento): an annotation lists those moves, a larger one fails, and the slots up to and including the project still fail at 16 px                                                                                                                                                                                        |
| Motion        | default                                                      | Anything on the page animating under reduced motion; anything but the now playing equaliser animating otherwise, or the equaliser animating more than `transform` (the equaliser check skips when nothing plays)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Console       | 1440, 768, 375                                               | A console error, page error or hydration warning while loading, opening the palette and resizing across the tiers. An init script logs each window error event with no error object as a console error, so the ResizeObserver loop error (which reaches neither Playwright listener on its own) counts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

The estimate widths are common phones, the widths near the tiers' edges, and md's two bands and
md-wide where the slots after the project move (720, 820 and 900 px). In a desktop browser their
bentos are 333, 348, 370, 454, 550, 646, 665, 711, 761, 838, 893 and 1136 px. On a phone each but
the last is 10 px wider (343, 358, 380, 464, 560, 656, 675, 721, 771, 848 and 903), since only a
desktop browser has the thin scrollbar gutter `globals.css` keeps.

Every check waits deterministically: no `S:` segment left hidden and nothing in main
`aria-busy` (as `visual/shell-grid.spec.ts` waits), images decoded and fonts loaded, then the
slots unmoved across two animation frames, a task and a third frame, with every `--rows-js` the
masonry wrote equal to its slot's height in rows. The masonry writes its spans the frame after a
slot resizes, so two quiet frames alone can end before its write lands. A page without JavaScript
is measured once its ten slots are in and its fonts have loaded. In a browser that lays out
`display: grid-lanes` natively there are no spans, and the span, estimate and first paint checks
skip. The selectors, that wait, the masonry measure and the slots' states live in
`fixtures/home-bento.ts`, which `visual/homepage.spec.ts` shares. What the estimate and first
paint checks compare is in `fixtures/home-bento-estimates.ts`, with no Playwright import, so
`tests/unit/home/bento-estimate-checks.test.ts` runs it on made-up measures.

When a tile's design changes its height, update the estimate table (`BENTO_TILE_HEIGHTS_PX` in
`src/app/_components/home/bento-layout.ts`, one column per tier: sm, sm-wide from a 30rem bento,
md, md-wide from 50rem, lg from 67.5rem). A tile in one lane gets a height within 16 px of the
heights it takes across the tier, its content's variants included (a place name on one line or
two); a tile that spans every lane gets the smallest height it takes in the tier. One tile cannot
meet that: the project at md and md-wide, whose 2:1 cover grows with its lane, so no one value is
within 16 px of both ends. It is listed in `BENTO_ESTIMATE_GAPS` next to the table, with the range
measured in each tier (271.2 to 310.9 px across md, 311.1 to 380.8 px across md-wide): re-measure
those with the table, and when the tile shows another project, since they were measured with a
one-line title and description (a two-line one is about 20 to 26 px taller). The estimate check
fails the project outside its range (by more than 2 px), or reserving rows outside it, and reports
a miss inside it as an annotation. In those tiers the first paint check lets the slots
after it move up to 48 px (`FIRST_PAINT_GAP_MOVE_MAX_PX`) and lists those moves in an annotation:
at md (about 683 to 860 px windows) the project's miss and GitHub's add up through the rows they
share (and the place's two-line hedge for the site index below it), and at md-wide roles and the
site index can swap lanes (about 1086 to 1210 px windows).
Keep that list to such tiles: `tests/unit/home/bento-areas.test.ts` checks that each range holds
its estimate, is wider than 32 px and belongs to a tile in one lane. Then run the estimate and
first paint checks against a server with every API key, so that every tile shows its reference
content (without keys, the tiles in error states are left out and the first paint check does not
run):

```bash
bunx playwright test e2e/journeys/home-bento.spec.ts --project=chromium -g "masonry"
```

## Running Tests

```bash
# Run all E2E tests
bun run test:e2e

# Run specific browser
bun run test:e2e -- --project=chromium
bun run test:e2e -- --project=firefox
bun run test:e2e -- --project=webkit

# Run with UI (interactive mode)
bun run e2e:ui

# Run specific test file
bun run test:e2e -- e2e/journeys/navigation.spec.ts

# Run specific category
bun run test:e2e -- e2e/accessibility/
bun run test:e2e -- e2e/performance/
bun run test:e2e -- e2e/seo/

# Run in CI (Chromium only)
bun run e2e:ci
```

## Authentication

For tests requiring authentication:

1. Auth state is stored in `playwright/.auth/`
2. Use the `authenticatedPage` fixture for logged-in tests
3. Auth setup runs once per worker, not per test

```typescript
import { test } from '@/e2e/fixtures/base';

test('authenticated user can post message', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/guestbook');
  // ... test with authenticated state
});
```

## Best Practices

1. **Use page objects** for complex pages
2. **Wait for network idle** before assertions on dynamic content
3. **Use test isolation** - each test should be independent
4. **Prefer data-testid** over text selectors for stability
5. **Screenshot on failure** - enabled by default in config

## Cross-Browser Testing

- **Chromium**: Primary, runs in CI
- **Firefox**: Run locally and in nightly builds
- **WebKit**: Safari engine coverage

## SSO/Auth Flows

Playwright handles multi-domain auth flows naturally with browser contexts. No special configuration
needed for OAuth redirects.
