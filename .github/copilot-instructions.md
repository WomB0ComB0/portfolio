# Copilot Instructions for AI Coding Agents

## Project Overview

- This is a Next.js (App Router) + TypeScript application for a personal portfolio, blog, and
  interactive dashboard for Mike Odnis.
- The app integrates with Firebase (Auth, Firestore), Stripe, Spotify, GitHub, Google Analytics,
  Lanyard (Discord), and WakaTime APIs.
- **Observability:** Integrates **Sentry** and **Vercel OpenTelemetry** for tracing and error
  tracking (`src/instrumentation.ts`).
- **PWA:** Configured as a Progressive Web App (PWA) using `@ducanh2912/next-pwa`
  (`next.config.mjs`).

## Key Architectural Patterns

- **App Router**: All page routes are in `src/app/(routes)`; API endpoints are in `src/app/api` (not
  `/pages/api`).
- **API Layer**: All server-side logic and third-party integrations are in `src/app/api/v1/`. The
  catch-all route (`src/app/api/v1/[[...route]]/route.ts`) is an **Elysia.js** server instance,
  handling rate limiting, security headers (Helmet), CORS, and OpenTelemetry tracing for internal
  API calls.
- **Parallel Routes/Modals**: Uses Next.js Parallel Routes (`@modal`) to display detailed views
  (e.g., `/experience/[id]`, `/projects/[id]`) as modals that overlay the current page.
- **Providers**: `src/providers/Providers.tsx` composes all React context providers (theme, query,
  events, liveblocks, etc.).
- **State Management**: Uses **Jotai** (for Firebase Auth, Firestore real-time data) and **Zustand**
  (for simple client-side state, persisted to localStorage).
- **Data Fetching**: Uses **@tanstack/react-query** for client-side data fetching, with
  `lib/fetcher.ts` as the main Axios-based utility.
- **Validation**: **Zod** is used extensively for API request/response validation.
- **UI & Styling**: Uses base UI components from `src/components/ui/` (built in the **shadcn/ui**
  style) and custom components like `magicui/` for effects. The primary font is **Kodchasan**
  (defined in `tailwind.config.ts`).
- **Generated Code**: GraphQL types for GitHub are generated in `src/generated/` using
  `graphql-codegen`.

## Developer Workflows

- **Package Manager**: **Bun** is the primary package manager.
- **Build**: `bun run build`.
- **Dev**: `bun run dev` (starts Next.js dev server).
- **Testing (Unit)**: `bun run test` (uses **Vitest** for unit tests, configured in
  `vitest.config.ts`).
- **Testing (E2E)**: `bun run e2e:ci` (uses **Playwright** for End-to-End tests in `src/e2e/`).
- **Lint/Format**: `bun run lint` (uses **Biome** for JavaScript/TypeScript and **Stylelint** for
  CSS/SCSS).
- **Typecheck**: `bun run typecheck`.
- **Bundle Analysis**: `bun run analyze` (runs build + `report-bundle-size.js`).

## Project-Specific Conventions

- **API Endpoints**: Always use `/api/v1/...` for new endpoints. Leverage Elysia.js for new backend
  routes in the catch-all. Implement caching and Zod validation where possible.
- **Client/Server Separation**: Use `'use client'` at the top of client components. Server-only code
  (e.g., `lib/blogs.ts`, `lib/get-repos.ts`) must not be imported into client components.
- **State**: Use Jotai for async state (Firebase, Firestore), Zustand for simple global client
  state.
- **Styling**: Tailwind CSS is used throughout. Use `cn` from `lib/utils.ts` for class merging.
- **Metadata/SEO**: Use helpers from `utils/meta.ts` (`constructMetadata`, `constructViewport`) to
  manage page metadata.
- **Third-party keys**: Managed via environment variables, not hardcoded.

## Integration Points

- **Firebase**: See `src/core/firebase.ts`, `src/core/auth.ts`, `src/core/db.ts` (Auth, Firestore).
- **Stripe**: See `/api/webhook` (for Stripe webhooks), Stripe checkout utility is implemented but
  hidden in the provided files.
- **Spotify**: See `src/lib/spotify.ts`, `/api/v1/now-playing`, `/api/v1/top-artists`,
  `/api/v1/top-tracks`.
- **GitHub**: See `src/lib/get-repos.ts` (GraphQL for pinned repos), `/api/v1/github-stats` (REST
  API for stats).
- **Google Analytics**: See `src/lib/google.ts`, `/api/v1/google`.
- **Lanyard (Discord)**: See `/api/v1/lanyard`.
- **WakaTime**: See `/api/v1/wakatime`.
- **Hashnode (Blog)**: See `src/lib/blogs.ts`, `/api/v1/blog`.

## Examples

- To add a new API endpoint: create a new folder in `src/app/api/v1/`, add a `route.ts` with the
  handler (or extend the Elysia app in the catch-all), and implement caching/Zod validation.
- To add a new UI primitive: add to `src/components/ui/` and export from `src/components/index.ts`.
- To add a new provider: add to `src/providers/`, then compose in `src/providers/Providers.tsx`.

## References

- See `README.md` for a full directory and feature overview.
- See `src/app/api/v1/` for all API endpoints and integration logic.
- See `src/components/` for UI patterns and composition.
- See `src/core/` and `src/providers/` for app-wide logic and context.
- CI/CD pipelines are managed via GitHub Actions in `.github/workflows/`.
