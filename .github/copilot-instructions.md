# Copilot Instructions for AI Coding Agents

## Project Overview
- This is a Next.js (App Router) + TypeScript monorepo for a personal portfolio, blog, and dashboard for Mike Odnis.
- The app integrates with Firebase (Auth, Firestore), Stripe, Spotify, GitHub, Google Analytics, Lanyard (Discord), and WakaTime APIs.
- Uses both server and client components, with heavy use of React Context Providers and Jotai/Zustand for state management.

## Key Architectural Patterns
- **App Router**: All routes are in `src/app/(routes)`; API endpoints in `src/app/api` (not `/pages/api`).
- **API Layer**: All server-side logic and third-party integrations are in `src/app/api/v1/` (see `route.ts` files for each endpoint).
- **Providers**: `src/providers/Providers.tsx` composes all React context providers (theme, query, events, liveblocks, etc.).
- **State Management**: Uses Jotai (for Firebase Auth, Firestore) and Zustand (for client state, persisted to localStorage).
- **Data Fetching**: Uses `@tanstack/react-query` for client-side data fetching, with `lib/fetcher.ts` as the main fetch utility.
- **Validation**: Zod is used for API response validation.
- **UI Primitives**: Most base UI components are in `src/components/ui/` (shadcn/ui style). Feature components are grouped by domain.
- **Generated Code**: GraphQL types for GitHub are generated in `src/generated/`.

## Developer Workflows
- **Build**: Use `bun run build` (Bun is the package manager).
- **Dev**: Use `bun run dev` to start the Next.js dev server.
- **Test**: E2E tests are in `src/e2e/` (Playwright). Run with `bun run test` or `bunx playwright test`.
- **Lint/Format**: Use `bun run lint` and `bun run format`.
- **Typecheck**: Use `bun run typecheck`.
- **Bundle Analysis**: Run `node report-bundle-size.js` for bundle size stats.

## Project-Specific Conventions
- **API endpoints**: Always use `/api/v1/...` for new endpoints. Implement caching and Zod validation where possible.
- **Client/server separation**: Use `'use client'` at the top of client components. Server-only code (e.g., API keys) must not be imported into client components.
- **State**: Use Jotai for async state (Firebase, Firestore), Zustand for simple client state.
- **Styling**: Tailwind CSS is used throughout. Use `cn` from `lib/utils.ts` for class merging.
- **Metadata/SEO**: Use helpers from `utils/meta.ts` to construct metadata and viewport.
- **Third-party keys**: Managed via environment variables, not hardcoded.
- **Testing**: Place E2E tests in `src/e2e/`. Use Playwright for browser automation.

## Integration Points
- **Firebase**: See `src/core/firebase.ts`, `src/core/auth.ts`, `src/core/db.ts`.
- **Stripe**: See `src/lib/stripe.ts`, `/api/v1/checkout`, `/api/webhook`.
- **Spotify**: See `src/lib/spotify.ts`, `/api/v1/now-playing`, `/api/v1/top-artists`, `/api/v1/top-tracks`.
- **GitHub**: See `src/lib/get-repos.ts`, `/api/v1/github-stats`.
- **Google Analytics**: See `src/lib/google.ts`, `/api/v1/google`.
- **Lanyard (Discord)**: See `/api/v1/lanyard`.
- **WakaTime**: See `/api/v1/wakatime`.

## Examples
- To add a new API endpoint: create a new folder in `src/app/api/v1/`, add a `route.ts` with the handler, and update `constants/index.ts` if needed.
- To add a new UI primitive: add to `src/components/ui/` and export from `src/components/index.ts`.
- To add a new provider: add to `src/providers/`, then compose in `Providers.tsx`.

## References
- See `README.md` for a full directory and feature overview.
- See `src/app/api/v1/` for all API endpoints and integration logic.
- See `src/components/` for UI patterns and composition.
- See `src/core/` and `src/providers/` for app-wide logic and context.
