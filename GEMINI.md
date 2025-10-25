Of course! Here is a `GEMINI.md` file to help you customize your interactions with the Gemini CLI
for your portfolio project. This file is structured to give Gemini the necessary context about your
project's architecture, technologies, and conventions.

---

# GEMINI.md

Hello, Gemini! This document provides instructions and context to help you understand and assist
with the `womb0comb0-portfolio` project. Use this as your guide for generating code, explaining
concepts, and suggesting improvements.

## 1. Project Goal & Overview

This is a high-performance, interactive personal portfolio for developer Mike Odnis ("Womb0ComB0").
It's built as a modern full-stack application showcasing projects, skills, real-time activity (like
Spotify and Discord), and a blog. The goal is to demonstrate advanced web development techniques
while providing an engaging user experience.

## 2. Core Technologies & Stack

Understanding the stack is crucial. Here are the key technologies you should be aware of:

- **Runtime & Package Manager**: **Bun**. All commands should use `bun` (e.g., `bun install`,
  `bun dev`).
- **Framework**: **Next.js 15+** with the **App Router**.
- **Language**: **TypeScript**.
- **Backend API**: **Elysia.js**. This is a high-performance, Bun-first framework. The API is
  integrated directly into the Next.js `src/app/api` directory.
- **Styling**: **Tailwind CSS** with **shadcn/ui** and **MagicUI** for components and effects.
- **CMS**: **Sanity.io** is used as a headless CMS to manage content like projects, work experience,
  and certifications.
- **Database & Auth**: **Firebase** (specifically Firestore for the guestbook and Firebase Auth for
  user sign-in).
- **State Management**:
  - **TanStack Query (React Query)** for server-state, caching, and data fetching.
  - **Jotai** for simple, global client-side state.
- **Testing**:
  - **Vitest** for unit and integration tests.
  - **Playwright** for end-to-end tests.
- **Code Quality**: **Biome** is used for linting and formatting.
- **Deployment**: The application is designed for **Vercel** and includes a **Dockerfile** for
  containerized deployments.
- **Observability**: **Sentry** and **OpenTelemetry** are integrated for error tracking and
  performance monitoring.

## 3. Architecture Deep Dive

The project has a sophisticated structure. Here are the main parts:

### Frontend (Next.js App Router)

- **Routing**: Found in `src/app/(routes)/`. It uses route groups like `(main)`, `(dev)`, and
  `(legal)` to organize sections of the site without affecting the URL.
- **Components**: Reusable UI components are in `src/components/`. We follow the shadcn/ui pattern,
  with base components in `src/components/ui/`.
- **Providers**: All global context providers (Theme, TanStack Query, etc.) are composed in
  `src/app/_providers/global-provider.tsx`.
- **Static Content**: Public assets like images and fonts are in the `public/` directory.

### Backend (Elysia.js API)

- **Location**: The entire backend API lives within `src/app/api/`.
- **Entry Points**: There are two main Elysia instances:
  1.  `src/app/api/[[...route]]/route.ts` (for general/admin routes).
  2.  `src/app/api/v1/[[...route]]/route.ts` (for all version 1 public data routes).
- **Structure**: Each API endpoint (e.g., `blog`, `spotify`, `github-stats`) is a self-contained
  module with `handlers.ts`, `schema.ts` (for validation), and `middleware.ts`. These modules are
  then imported and used by the main `elysia.ts` file in that directory.
- **Data Fetching**: The API layer is responsible for fetching data from all third-party services
  (GitHub, Spotify, Sanity, etc.) and caching it.

### Content & Data

- **Sanity.io**: The schema for the CMS content is defined in `src/sanity/schemaTypes/`. The Sanity
  Studio can be run locally with `bun sanity dev`.
- **Firebase**: The guestbook feature uses Firebase. The configuration is in `src/core/firebase.ts`,
  and the authentication logic is in `src/core/auth.ts`.
- **Third-Party Integrations**: Logic for fetching from services like Spotify, GitHub, and Lanyard
  is located in `src/lib/api-integrations/`.

## 4. How to Help Me (Your Role)

When I ask for help, keep these conventions in mind:

#### **Adding New Features:**

- **New Page**: If I ask for a new page, create a new folder under `src/app/(routes)/(main)/`. The
  page should use the main `Layout` from `src/components/layout/layout.tsx`.
- **New UI Component**: If it's a general-purpose UI element (like a button or card), add it to
  `src/components/ui/` and follow the shadcn/ui style (using `cva` for variants). If it's a more
  complex, feature-specific component, place it within that feature's directory (e.g.,
  `src/app/(routes)/(main)/blog/_components/`).
- **New API Endpoint**:
  1.  Create a new folder in `src/app/api/v1/[[...route]]/`.
  2.  Create `handlers.ts` for the business logic.
  3.  Create `schema.ts` using `elysia/t` for request/response validation.
  4.  Create `index.ts` to define the Elysia route.
  5.  Import and `.use()` the new route in `src/app/api/v1/[[...route]]/elysia.ts`.

#### **Writing Code:**

- **Always use TypeScript**.
- **Follow the existing code style**. The project uses **Biome** for formatting, which prefers
  single quotes and 2-space indentation.
- **Use the `cn` utility** from `src/lib/utils.ts` for merging Tailwind CSS classes.
- **Prioritize Server Components** where possible. Only use `'use client'` when interactivity is
  required.
- **For data fetching on the client**, use TanStack Query (`useQuery`). The backend API endpoints
  are already set up to be called from the client.

#### **Running Commands:**

Remember that we use **Bun**. Here are the primary commands:

| Command          | Description                                       |
| ---------------- | ------------------------------------------------- |
| `bun install`    | Install dependencies.                             |
| `bun dev`        | Start the local development server.               |
| `bun build`      | Build the application for production.             |
| `bun lint`       | Run Biome to check and fix linting/format issues. |
| `bun test`       | Run unit tests with Vitest.                       |
| `bun test:e2e`   | Run end-to-end tests with Playwright.             |
| `bun sanity dev` | Start the local Sanity Studio CMS.                |

## 5. Important Files to Reference

- `README.md`: High-level overview of the project and its features.
- `package.json`: For a complete list of dependencies and scripts.
- `next.config.ts`: Contains configurations for PWA, Sentry, and bundle analysis.
- `tailwind.config.ts`: Defines the theme, colors, and fonts.
- `src/env.ts`: Zod schema for environment variables. This is the source of truth for all
  `process.env` access.
- `src/lib/api-integrations/`: Contains the logic for fetching data from external services.
- `src/app/api/v1/[[...route]]/elysia.ts`: The composition root for all v1 API endpoints.

Thanks for your help! By following these guidelines, you'll be able to assist with this project
effectively.
