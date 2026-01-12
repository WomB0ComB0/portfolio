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
│   └── seo.spec.ts       # Meta tags, OG, structured data
├── visual/               # Visual regression tests
│   └── homepage.spec.ts
├── fixtures/             # Playwright fixtures
│   ├── auth.setup.ts     # Auth state setup
│   └── base.ts           # Extended test fixtures
└── README.md
```

## Test Categories

### Journeys (`e2e/journeys/`)

User journey tests that verify end-to-end flows:

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
