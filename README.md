# Portfolio

## Project Documentation: Personal Portfolio

This document outlines the structure and key components of the Next.js application, likely serving as a personal portfolio, blog, and interactive dashboard.

**Table of Contents:**

1.  [Project Overview](#project-overview)
2.  [Directory Structure](#directory-structure)
3.  [Key Files & Concepts](#key-files--concepts)
4.  [Routing (`app/(routes)`)](#routing-approutes)
5.  [API Routes (`app/api`)](#api-routes-appapi)
6.  [Components (`components`)](#components-components)
    *   [UI Primitives (`components/ui`)](#ui-primitives-componentsui)
    *   [Magic UI (`components/magicui`)](#magic-ui-componentsmagicui)
    *   [Layout Components (`components/layout`)](#layout-components-componentslayout)
    *   [Feature Components](#feature-components)
    *   [Client Components (`components/client`)](#client-components-componentsclient)
    *   [Custom Components (`components/custom`)](#custom-components-componentscustom)
    *   [Icons (`components/icons`)](#icons-componentsicons)
7.  [Core Modules (`core`)](#core-modules-core)
8.  [Providers (`providers`)](#providers-providers)
9.  [Libraries & Utilities (`lib`, `utils`)](#libraries--utilities-lib-utils)
10. [Constants (`constants`)](#constants-constants)
11. [Data (`data`)](#data-data)
12. [Generated Files (`generated`)](#generated-files-generated)
13. [Hooks (`hooks`)](#hooks-hooks)
14. [Observability (`instrumentation.ts`)](#observability-instrumentationts)
15. [Testing (`e2e`)](#testing-e2e)
16. [Styles (`styles`)](#styles-styles)
17. [Types (`types`)](#types-types)

---

### 1. Project Overview

This project is a modern web application built with Next.js (App Router) and TypeScript. It functions primarily as a personal website for Mike Odnis, showcasing his profile, skills, resume, blog posts, projects, and various real-time statistics (Spotify activity, coding stats, etc.). It includes features like a guestbook, interactive maps, and potentially e-commerce functionality for hiring services via Stripe. The application leverages server components, client components, API routes, and integrates with several third-party services and APIs.

---

### 2. Directory Structure

```
.
└── src/                      # Main source code directory
    ├── app/                  # Next.js App Router directory
    │   ├── (routes)/         # Route group for main application pages
    │   ├── _components/      # Private components specific to the app directory (e.g., Liveblocks)
    │   ├── api/              # API Route handlers
    │   ├── global-error.tsx  # Global error boundary
    │   ├── layout.tsx        # Root layout component
    │   ├── loading.tsx       # Root loading UI
    │   ├── manifest.ts       # PWA Web App Manifest generator
    │   ├── not-found.tsx     # Custom 404 Not Found page
    │   ├── page.tsx          # Root page component (Homepage)
    │   ├── robots.ts         # robots.txt generator
    │   └── sitemap.ts        # sitemap.xml generator
    ├── components/           # Reusable UI components shared across the app
    │   ├── animation/        # Animation-related components
    │   ├── client/           # Explicitly client-side components
    │   ├── custom/           # Custom application-specific components (e.g., Login/Logout buttons)
    │   ├── github/           # Components related to GitHub data display
    │   ├── icons/            # SVG Icon components
    │   ├── layout/           # Layout structure components (Nav, Footer, etc.)
    │   ├── magicui/          # Special UI effect components
    │   ├── markers/          # Map marker components
    │   ├── music/            # Spotify/Music related components
    │   └── ui/               # Base UI primitives (likely shadcn/ui based)
    ├── constants/            # Application constants (app info, client settings)
    ├── core/                 # Core application logic (Auth, DB, Firebase, Store)
    ├── data/                 # Static data files (e.g., places data)
    ├── e2e/                  # End-to-end tests (Playwright)
    ├── generated/            # Auto-generated files (e.g., GraphQL types)
    ├── hooks/                # Custom React Hooks
    ├── instrumentation.ts    # OpenTelemetry/Sentry Instrumentation
    ├── lib/                  # Utility functions, helpers, actions, API clients
    ├── providers/            # React Context providers (Theme, Query, Liveblocks, etc.)
    ├── schema/               # Data validation schemas (e.g., Zod)
    ├── scripts/              # Client-side scripts component
    ├── styles/               # Global styles and fonts
    ├── types/                # Global TypeScript types
    └── utils/                # General utility functions
```

---

### 3. Key Files & Concepts

*   **`src/app/layout.tsx`**: Defines the root HTML structure, applies global styles, includes essential scripts (Analytics, GTM), and wraps the application in the main `Providers` component. Sets up metadata and viewport defaults.
*   **`src/providers/Providers.tsx`**: Composes various context providers (`ThemeProvider`, `KBarProvider`, `QueryProvider`, `Events`, etc.) to make them available throughout the application. Uses a `ProviderStack` helper for clean composition.
*   **`src/core/firebase.ts`**: Initializes the Firebase app instance and exports Firestore, Auth services. Handles emulator connections in development.
*   **`src/core/auth.ts`**: Manages Firebase authentication state using Jotai atoms (`currentUserAsync`, `currentUserLoadable`) and provides custom hooks (`useCurrentUser`, `useSignIn`, `useSignOut`) for interacting with auth.
*   **`src/core/db.ts`**: Sets up Firestore data fetching (e.g., for messages) using Jotai atoms for real-time updates (`messagesCollectionAtom`).
*   **`src/core/store.ts`**: Defines a Zustand store (`useStore`) potentially for simple global client-side state, persisted to localStorage.
*   **`src/lib/fetcher.ts`**: An Axios-based utility function for making client-side data requests, likely used with `@tanstack/react-query`.
*   **`src/utils/meta.ts`**: Helper functions (`constructMetadata`, `constructViewport`) to generate default and page-specific metadata/viewport configurations for SEO and PWA behavior.
*   **`src/components/CMD.tsx`**: Implements the command palette using `kbar`, allowing users to navigate and perform actions quickly. Uses actions defined in `src/lib/actions.ts`.

---

### 4. Routing (`app/(routes)`)

The application uses the Next.js App Router. Routes are defined by folders within the `app/(routes)` directory group. Each route typically has a `page.tsx` file defining its UI.

*   **`/` (`src/app/page.tsx`)**: Homepage. Displays user introduction, profile picture, and dynamically loaded pinned GitHub repositories using `<DynamicPinnedRepos>`.
*   **`/about` (`src/app/(routes)/about/page.tsx`)**: About page. Displays detailed information about Mike Odnis, including a bio, profile picture, social links (GitHub, LinkedIn, Email, Google Scholar), skills, education, and certifications using `Card` and `Button` components. It's a client component (`'use client'`).
*   **`/blog` (`src/app/(routes)/blog/page.tsx`)**: Blog page. Renders the `<Blog>` component which fetches and displays blog posts (likely from Hashnode via `/api/v1/blog`).
*   **`/dashboard` (`src/app/(routes)/dashboard/page.tsx`)**: Dashboard page. Displays various statistics and real-time information using the `<Discord>` (Lanyard status) and `<Stats>` (Age, Views, Coding Hours) components.
*   **`/guestbook` (`src/app/(routes)/guestbook/page.tsx`)**: Guestbook page. Renders the `<GuestbookComponent>` which allows authenticated users (Firebase Auth) to leave messages and view messages from others (fetched from Firestore via `/api/v1/messages`).
*   **`/hire` (`src/app/(routes)/hire/page.tsx`)**: Hire Me page. Presents different service tiers with features and pricing. Uses Stripe (`@stripe/stripe-js`, `/api/v1/checkout`, `src/lib/stripe.ts`) to handle payments. It's a client component with animations (`framer-motion`).
*   **`/hire/[all]` (`src/app/(routes)/hire/[all]/page.tsx`)**: Catch-all route under `/hire` that redirects any sub-path (e.g., `/hire/success`, `/hire/cancel`) back to the main `/hire` page. *Note: This might be intended for handling Stripe redirect statuses, but the current implementation simply redirects everything back to `/hire`.*
*   **`/links` (`src/app/(routes)/links/page.tsx`)**: Links page. Displays a list of social and professional links defined in `src/lib/links.ts`. Uses `motion.div` for hover/tap effects.
*   **`/places` (`src/app/(routes)/places/page.tsx`)**: Places page. Shows locations visited (hackathons, events) using a `<GoogleMaps>` component (from `@vis.gl/react-google-maps`) and a list view within `Tabs`. Data is sourced from `src/data/places.ts`.
*   **`/resume` (`src/app/(routes)/resume/page.tsx`)**: Resume page. Embeds a Google Doc resume using an `<iframe>`. Provides buttons to download as PDF or open in Google Docs. Includes a loading skeleton (`Skeleton`).
*   **`/spotify` (`src/app/(routes)/spotify/page.tsx`)**: Spotify stats page. Displays `<NowPlaying>`, `<TopArtists>`, and `<TopTracks>` components within `Tabs`, fetching data from the Spotify API via corresponding `/api/v1/...` endpoints.

---

### 5. API Routes (`app/api`)

API routes handle server-side logic, data fetching from third parties, and interactions with the database/backend services.

*   **`GET /api/health`**: Simple health check endpoint returning "OK" status 200.
*   **`GET /api/v1/blog`**: Fetches blog posts (likely from Hashnode) using `lib/blogs.ts`. Implements caching (`CACHE_DURATION`) and uses `superjson` for serialization.
*   **`POST /api/v1/checkout`**: Handles Stripe checkout session creation using `lib/stripe.ts`. Expects a `priceId` in the request body.
*   **`GET /api/v1/github-stats`**: Fetches GitHub user stats (repos, followers, avatar) and repository information (top repos, stars, languages) directly from the GitHub API. Uses Zod for validation and implements caching.
*   **`GET /api/v1/google`**: Fetches Google Analytics data (specifically total pageviews) using `lib/google.ts`. Implements caching and provides fallback data on error.
*   **`GET /api/v1/lanyard`**: Fetches Discord presence information (status, activity) from the Lanyard API using the user's Discord ID. Uses Zod for validation and implements caching.
*   **`GET /api/v1/messages`**: Fetches the latest 50 guestbook messages from Firestore, ordered by creation date. Implements caching.
*   **`POST /api/v1/messages`**: Adds a new guestbook message to Firestore. Requires `authorName` and `message`. Invalidates the GET cache. Uses `superjson`.
*   **`GET /api/v1/now-playing`**: Fetches the currently playing song from Spotify using `lib/spotify.ts`. Returns `isPlaying: false` if nothing is playing. No server-side caching (`Cache-Control: no-cache`).
*   **`GET /api/v1/top-artists`**: Fetches the user's top Spotify artists using `lib/spotify.ts`. Implements caching.
*   **`GET /api/v1/top-tracks`**: Fetches the user's top Spotify tracks using `lib/spotify.ts`. Implements caching.
*   **`GET /api/v1/wakatime`**: Fetches coding time statistics from the WakaTime API using an API key. Implements caching.
*   **`POST /api/webhook`**: Handles incoming Stripe webhooks. Verifies the signature and processes relevant events (product/price updates, subscription changes, checkout completion) using helper functions in `webhook/admin.ts`.
*   **`src/app/api/webhook/admin.ts`**: Contains helper functions used by the Stripe webhook handler to manage product, price, customer, and subscription data (though the current implementation mostly logs console messages instead of database operations).

---

### 6. Components (`components`)

This directory holds reusable React components.

#### UI Primitives (`components/ui`)

Likely based on `shadcn/ui`, providing styled, accessible base components:

*   `avatar.tsx`, `badge.tsx`, `button.tsx`, `card.tsx`, `dropdown-menu.tsx`, `form.tsx`, `input.tsx`, `label.tsx`, `number-ticker.tsx`, `scroll-area.tsx`, `skeleton.tsx`, `sonner.tsx` (Toasts), `tabs.tsx`, `textarea.tsx`, `tooltip.tsx`.

#### Magic UI (`components/magicui`)

Components implementing special visual effects:

*   `blur-fade.tsx`: Component that fades in with a blur effect.
*   `border-beam.tsx`: Adds an animated beam effect to borders.
*   `dot-pattern.tsx`: Renders a background dot pattern.
*   `magic-card.tsx`: Card component with a mouse-following gradient effect.
*   `particles.tsx`: Renders animated background particles that react to mouse movement.

#### Layout Components (`components/layout`)

Components responsible for the overall page structure:

*   `Layout.tsx`: Main layout wrapper including Nav, Footer, background effects, and Liveblocks provider.
*   `Nav.tsx`: Desktop sidebar navigation.
*   `MobileNav.tsx`: Bottom navigation bar for mobile devices.
*   `Footer.tsx`: Site footer with copyright and links.

#### Feature Components

Components specific to certain features or pages:

*   **`Blog.tsx`**: Fetches blog posts using `useQuery` and renders them, likely in a grid of cards. Includes loading (`BlogSkeleton`) and error (`ErrorMessage`) states. Uses Jotai atoms (`blogAtom`, `blogEffectAtom`) potentially for state management or effects.
*   **`CMD.tsx`**: Renders the `kbar` command palette UI, including the search input and results rendering logic (`RenderResults`, `ResultItem`).
*   **`Discord.tsx`**: Fetches and displays Discord presence from Lanyard API (`useQuery`). Shows avatar, status, activity, and an "Add Friend" button.
*   **`Guestbook.tsx`**: Handles displaying guestbook messages and the form for submitting new messages. Integrates with Firebase Auth (`useCurrentUser`) and Firestore (`usePostMessage`, `useQuery`). Includes loading/error states and login buttons.
*   **`Stats.tsx`**: Displays various statistics (Age, Views, Coding Hours) fetched from different API endpoints (`useQueries`). Uses `<NumberTicker>` for animated numbers. Includes skeleton loading state.
*   **`github/PinnedRepos.tsx`**: Displays pinned GitHub repositories passed as props (`pinnedRepos`). Includes a loading state with skeletons. Uses `Card`, `Badge`, `Tooltip`.
*   **`github/Repository.tsx`**: (Likely used elsewhere or deprecated) Renders details for a single GitHub repository.
*   **`markers/Map.tsx`**: Renders a Google Map using `@vis.gl/react-google-maps`, displaying markers from `data/places.ts`. Includes marker clustering (`@googlemaps/markerclusterer`) and info windows.
*   **`music/NowPlaying.tsx`**: Fetches and displays the currently playing Spotify track (`useQuery`). Includes skeleton state.
*   **`music/TopArtists.tsx`**: Fetches and displays top Spotify artists (`useQuery`). Includes loading/error states.
*   **`music/TopTracks.tsx`**: Fetches and displays top Spotify tracks (`useQuery`). Includes loading/error states.

#### Client Components (`components/client`)

*   **`Loader.tsx`**: Full-screen loading component with animated logo and particle background, used in `app/loading.tsx`.

#### Custom Components (`components/custom`)

*   **`login-button.tsx`**: Reusable button for signing in via different Firebase providers (Google, GitHub, Anonymous).
*   **`logout-button.tsx`**: Reusable button for signing out.

#### Icons (`components/icons`)

*   **`components/`**: Contains individual SVG icon components (e.g., `GitHubForkIcon.tsx`).
*   **`index.tsx`**: Exports an `Icons` object mapping names to icon components for easier usage.

---

### 7. Core Modules (`core`)

Contains fundamental application setup and logic.

*   **`auth.ts`**: Firebase Authentication setup, state management using Jotai, and hooks for sign-in/sign-out.
*   **`db.ts`**: Firestore database interaction setup, potentially using Jotai for real-time listeners.
*   **`firebase.ts`**: Firebase app initialization and configuration, including emulator setup for development.
*   **`store.ts`**: Zustand store setup for client-side state management, with persistence to localStorage.

---

### 8. Providers (`providers`)

React Context providers wrapping the application.

*   **`Providers.tsx`**: Central component that stacks all necessary providers using a helper function.
*   **`QueryProvider.tsx`**: Sets up `@tanstack/react-query`'s `QueryClientProvider` with default query function using `superjson`.
*   **`core/`**:
    *   `CustomAnimatedCursor.tsx`: Implements a custom animated cursor using `react-animated-cursor`.
    *   `Events.tsx`: Wraps the `Toaster` component for displaying notifications/toasts.
    *   `LiveRoom.tsx`: Sets up the Liveblocks `RoomProvider` and renders real-time cursors (`LiveRoom` component) using data from `useOthers`.
*   **`theme/ThemeProvider.tsx`**: Implements theme switching using `next-themes`.

---

### 9. Libraries & Utilities (`lib`, `utils`)

Helper functions, libraries, and API interaction logic.

*   **`lib/actions.ts`**: Defines actions (like navigation) for the `kbar` command palette.
*   **`lib/blogs.ts`**: Server-only function to fetch blog posts from Hashnode GraphQL API.
*   **`lib/fetcher.ts` / `fetcher.spec.ts`**: Client-side data fetching utility using Axios, with unit tests.
*   **`lib/getContrastingColor.ts`**: Utility to determine black or white text color based on a background hex color.
*   **`lib/getRepos.ts`**: Server-only function (using React Cache) to fetch pinned repositories from the GitHub GraphQL API.
*   **`lib/google.ts`**: Fetches and formats Google Analytics data using the official Node.js client library.
*   **`lib/links.ts`**: Defines the data structure and content for the `/links` page.
*   **`lib/spotify.ts`**: Contains functions to interact with the Spotify API (get access token, top tracks/artists, now playing).
*   **`lib/stripe.ts`**: Server-side utility to create Stripe checkout sessions.
*   **`lib/utils.ts`**: General utilities, primarily `cn` for merging Tailwind classes (from `clsx` and `tailwind-merge`).
*   **`utils/api.ts`**: Wrapper functions around `fetch` for making API calls (GET, POST, PUT, etc.) and validating JSON responses.
*   **`utils/meta.ts`**: Functions to construct Next.js `Metadata` and `Viewport` objects.
*   **`utils/platform.ts`**: Helper functions to detect the user's OS, browser, and if it's a touch device.
*   **`utils/stripe.ts`**: Initializes the Stripe Node.js client instance.

---

### 10. Constants (`constants`)

*   **`app.ts`**: Basic application information (name, URL, email, description).
*   **`client.ts`**: Client-side constants, like `COLORS` for Liveblocks cursors and `NavbarItems` defining navigation structure and icons.
*   **`index.ts`**: Barrel file exporting all constants.

---

### 11. Data (`data`)

*   **`places.ts`**: Static array containing data (name, description, lat, lng) for locations displayed on the `/places` map, along with custom map styles.

---

### 12. Generated Files (`generated`)

Files automatically generated, likely by GraphQL code generation tools.

*   **`github-schema-loader.d.ts` / `github-schema-loader.js`**: Files related to loading the GitHub GraphQL schema.
*   **`graphql.ts`**: Contains TypeScript types generated from the GitHub GraphQL schema, used for type safety in GraphQL queries (e.g., in `lib/getRepos.ts`).

---

### 13. Hooks (`hooks`)

Custom React hooks for reusable logic.

*   **`useIntervals.ts`**: A simple hook for setting up intervals.
*   **`useMessages.ts`**: Hook (`usePostMessage`) utilizing `@tanstack/react-query`'s `useMutation` to handle posting new guestbook messages, including optimistic updates and error handling.

---

### 14. Observability (`instrumentation.ts`)

*   Sets up Vercel OpenTelemetry (`@vercel/otel`) and Sentry (`@sentry/nextjs`) for performance monitoring and error tracking, distinguishing between Node.js and Edge runtimes.

---

### 15. Testing (`e2e`)

*   **`example.spec.ts`**: Contains an example end-to-end test using Playwright to visit the homepage and take a screenshot.

---

### 16. Styles (`styles`)

*   **`globals.css`**: Global CSS styles, including Tailwind CSS setup, base styles, CSS variables for theming (light/dark modes), custom loader styles, and potentially custom cursor styles (`.flare`).
*   **`fonts.css`**: Defines `@font-face` rules for loading custom fonts (Kodchasan).

---

### 17. Types (`types`)

*   **`global.d.ts`**: Contains global TypeScript type definitions used across the application (e.g., `SVGIconProps`, `MetadataProps`, basic types for API responses like `GithubStats`, `LanyardResponse`).
