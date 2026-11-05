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
 * @file Every page that loads Sanity data through a useSanity* suspense hook keeps a failed load
 * inside its own section. The /api/v1/sanity routes answer 503 when Sanity fails with nothing
 * cached; that used to reach src/app/error.tsx, which replaced the whole page and reported one
 * Sentry event per visitor. Now the site's layout (and the page title, where it doesn't depend on
 * the data) stays, the section shows its error with a Try again that loads it again, and a failed
 * fetch is not reported from the browser (the API route reports it). /resume answers 404 when no
 * resume is active, which shows "Resume Not Available" without a retry. PageErrorBoundary stands
 * in for src/app/error.tsx and for Next's not-found boundary.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Component, type ReactElement, type ReactNode, Suspense } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ reportError: vi.fn((_error: unknown) => true) }));

// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
// The shared queue rate-limits and deduplicates across tests; run each request directly.
vi.mock('@/lib/http-clients/request-queue', () => ({
  requestQueue: {
    enqueue: <T,>(_url: string, _method: string, run: () => Promise<T>) => run(),
  },
}));
vi.mock('@/lib/observability/report', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/observability/report')>()),
  reportError: h.reportError,
}));
// The site shell, reduced to a landmark the tests can look for.
vi.mock('@/components/layout/layout', () => ({
  default: ({ children }: { children?: ReactNode }) => (
    <>
      <nav aria-label="Site">site navigation</nav>
      {children}
    </>
  ),
}));
// client.ts require()s '@/env' at load; the pages only need the image URL builder.
vi.mock('@/lib/sanity/client', async () => {
  const { createImageUrlBuilder } = await import('@sanity/image-url');
  const builder = createImageUrlBuilder({ projectId: 'test', dataset: 'test' });
  return { urlFor: (source: Parameters<typeof builder.image>[0]) => builder.image(source) };
});
// The '@/components' barrel reaches the sign-in buttons, whose Firebase app needs real keys.
vi.mock('@/core/auth', () => ({
  useSignIn: () => [() => undefined, false],
  useSignOut: () => [() => undefined, false],
  useCurrentUser: () => null,
}));
// Google Maps needs a browser API key and network; the list is what is under test.
vi.mock('@/app/(routes)/(main)/(personal)/places/_components', () => ({
  GoogleMaps: () => <div>map</div>,
}));

import { Places } from '@/app/(routes)/(main)/(personal)/places/_interface/places/places';
import PlacePhotosPage from '@/app/(routes)/(main)/(personal)/places/[placeId]/page';
import { Certifications } from '@/app/(routes)/(main)/(professioal)/certifications/_interface/certifications/certifications';
import { ExperienceDetail } from '@/app/(routes)/(main)/(professioal)/experience/_interface/experience-detail/experience-detail';
import { ExperienceList } from '@/app/(routes)/(main)/(professioal)/experience/_interface/experience-list/experience-list';
import { ProjectDetail } from '@/app/(routes)/(main)/(professioal)/projects/_interface/project-detail/project-detail';
import { ProjectsList } from '@/app/(routes)/(main)/(professioal)/projects/_interface/projects-list/projects-list';
import { Resume } from '@/app/(routes)/(main)/(professioal)/resume/_interface/resume/resume';
import { FetcherError, ValidationError } from '@/lib/http-clients/effect-fetcher';
import { createQueryClient } from '@/providers/server/query-client';

const PAGE_ERROR = 'the whole page failed';

/** Stands in for src/app/error.tsx and Next's not-found boundary: names what escaped the page. */
class PageErrorBoundary extends Component<{ children: ReactNode }, { escaped: unknown }> {
  state = { escaped: null as unknown };

  static getDerivedStateFromError(error: unknown) {
    return { escaped: error };
  }

  render() {
    const { escaped } = this.state;
    if (!escaped) return this.props.children;
    const digest = (escaped as { digest?: unknown }).digest;
    return <p>{typeof digest === 'string' ? `escaped: ${digest}` : PAGE_ERROR}</p>;
  }
}

/** The production client, with only the retry delay shortened; whether to retry is unchanged. */
const productionClient = () => {
  const client = createQueryClient()();
  const defaults = client.getDefaultOptions();
  client.setDefaultOptions({ ...defaults, queries: { ...defaults.queries, retryDelay: 1 } });
  return client;
};

interface Reply {
  readonly status: number;
  readonly body: unknown;
}

const SANITY_DOWN: Reply = {
  status: 503,
  body: { error: 'Failed to fetch from Sanity', status: 503 },
};

/** Answers each request with the next reply; the last one repeats. */
const stubReplies = (...replies: Reply[]) => {
  let call = 0;
  const fetchMock = vi.fn(async () => {
    const { status, body } = replies[Math.min(call, replies.length - 1)] as Reply;
    call += 1;
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

/** Pages suspend on their data (and the place page on `use(params)`); act() lets them resume. */
const renderPage = async (page: ReactElement) => {
  await act(async () => {
    render(
      <QueryClientProvider client={productionClient()}>
        <PageErrorBoundary>
          <Suspense fallback={<p>loading</p>}>{page}</Suspense>
        </PageErrorBoundary>
      </QueryClientProvider>,
    );
  });
};

const META = {
  _createdAt: '2026-01-01T00:00:00Z',
  _updatedAt: '2026-01-01T00:00:00Z',
  _rev: 'r1',
};

const experience = {
  ...META,
  _id: 'e1',
  _type: 'experience',
  position: 'Platform Engineer',
  company: 'Example Co',
  description: 'Kept the lights on.',
  startDate: '2024-01-01',
  current: true,
  order: 1,
};

const project = {
  ...META,
  _id: 'p1',
  _type: 'project',
  title: 'Example Project',
  slug: { _type: 'slug', current: 'example-project' },
  description: 'A project used by the tests.',
  category: 'Web',
  technologies: ['TypeScript'],
  status: 'Live',
  featured: false,
  order: 1,
};

const place = {
  ...META,
  _id: 'pl1',
  _type: 'place',
  name: 'Example Venue',
  description: 'A place used by the tests.',
  category: 'Conference',
  latitude: 40.75,
  longitude: -73.99,
  startDate: '2026-05-12',
  photos: null,
  order: 1,
  featured: false,
};

const resume = {
  ...META,
  _id: 'resume-1',
  _type: 'resume',
  title: 'Resume',
  pdfFile: { _type: 'file', asset: { _ref: 'file-abc-pdf', _type: 'reference' } },
  lastUpdated: '2026-10-01',
  isActive: true,
};

interface Consumer {
  readonly name: string;
  readonly page: () => ReactElement;
  /** The page title, where the page shows one before its data loads. */
  readonly title?: string;
  /** The section's error text. */
  readonly failure: string;
  /** The retry button's label. */
  readonly retry: string;
  /** A good answer, and text the page shows once it has loaded it. */
  readonly loaded: { readonly body: unknown; readonly text: string };
}

const CONSUMERS: readonly Consumer[] = [
  {
    name: '/experience',
    page: () => <ExperienceList />,
    title: 'Work Experience',
    failure: "Couldn't load work experience right now.",
    retry: 'Try again',
    loaded: { body: [], text: 'No work experience listed at the moment.' },
  },
  {
    name: '/certifications',
    page: () => <Certifications />,
    title: 'My Certifications',
    failure: "Couldn't load certifications right now.",
    retry: 'Try again',
    loaded: { body: [], text: 'No certifications found' },
  },
  {
    name: '/projects',
    page: () => <ProjectsList />,
    title: 'My Projects',
    failure: 'Unable to Load Projects',
    retry: 'Try again',
    loaded: { body: [], text: 'No projects yet' },
  },
  {
    name: '/places',
    page: () => <Places />,
    failure: 'Unable to Load Places',
    retry: 'Try Again',
    loaded: { body: [], text: 'No places found' },
  },
  {
    name: '/experience/[id]',
    page: () => <ExperienceDetail params={{ id: 'e1' }} />,
    failure: "Couldn't load this experience right now.",
    retry: 'Try again',
    loaded: { body: [experience], text: 'Platform Engineer' },
  },
  {
    name: '/projects/[id]',
    page: () => <ProjectDetail params={{ id: 'p1' }} />,
    failure: "Couldn't load this project right now.",
    retry: 'Try again',
    loaded: { body: [project], text: 'Example Project' },
  },
  {
    name: '/places/[placeId]',
    page: () => <PlacePhotosPage params={Promise.resolve({ placeId: 'pl1' })} />,
    failure: "Couldn't load this place right now.",
    retry: 'Try again',
    loaded: { body: [place], text: 'Example Venue' },
  },
  {
    name: '/resume',
    page: () => <Resume />,
    failure: 'Resume Not Available',
    retry: 'Try again',
    loaded: { body: resume, text: 'Open PDF' },
  },
];

const expectShellIntact = (title?: string) => {
  expect(screen.getByRole('navigation', { name: 'Site' })).toBeInTheDocument();
  if (title) expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
  expect(screen.queryByText(PAGE_ERROR)).not.toBeInTheDocument();
};

beforeEach(() => {
  h.reportError.mockClear();
  // React and the QueryCache log the expected failures on console.error.
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe.each(CONSUMERS)('$name when Sanity is down', ({ page, title, failure, retry, loaded }) => {
  it('keeps the page and shows the error in the section, without reporting the fetch again', async () => {
    const fetchMock = stubReplies(SANITY_DOWN);

    await renderPage(page());

    expect(await screen.findByText(failure)).toBeInTheDocument();
    expectShellIntact(title);
    expect(screen.getByRole('button', { name: retry })).toBeInTheDocument();
    // The first attempt and the browser's one retry for a 5xx.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(h.reportError).not.toHaveBeenCalled();
  });

  it('loads the section again on Try again', async () => {
    const fetchMock = stubReplies(SANITY_DOWN, SANITY_DOWN, { status: 200, body: loaded.body });
    await renderPage(page());
    await screen.findByText(failure);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: retry }));
    });

    expect((await screen.findAllByText(loaded.text)).length).toBeGreaterThan(0);
    expect(screen.queryByText(failure)).not.toBeInTheDocument();
    expectShellIntact(title);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe('/resume with no active resume', () => {
  it('shows "Resume Not Available" for the 404, with no retry, and keeps the page', async () => {
    const fetchMock = stubReplies({
      status: 404,
      body: { error: 'No active resume', status: 404 },
    });

    await renderPage(<Resume />);

    expect(await screen.findByText('Resume Not Available')).toBeInTheDocument();
    expectShellIntact();
    // Asking again gets the same answer: no retry, and no button offering one.
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(h.reportError).not.toHaveBeenCalled();
  });
});

describe('detail pages with an unknown id', () => {
  it.each([
    ['/experience/[id]', () => <ExperienceDetail params={{ id: 'missing' }} />],
    ['/projects/[id]', () => <ProjectDetail params={{ id: 'missing' }} />],
  ])("%s still reach Next's 404 through notFound()", async (_name, page) => {
    stubReplies({ status: 200, body: [] });

    await renderPage(page());

    expect(await screen.findByText('escaped: NEXT_HTTP_ERROR_FALLBACK;404')).toBeInTheDocument();
  });
});

describe('a failed useSanity* query', () => {
  it("keeps the fetcher's own error, not Effect's FiberFailure wrapper", async () => {
    stubReplies(SANITY_DOWN);
    const client = productionClient();

    await act(async () => {
      render(
        <QueryClientProvider client={client}>
          <Certifications />
        </QueryClientProvider>,
      );
    });
    await screen.findByText("Couldn't load certifications right now.");

    const errors = client
      .getQueryCache()
      .getAll()
      .map((query) => query.state.error);
    expect(errors).toEqual([expect.any(FetcherError)]);
    expect(errors[0]).toHaveProperty('status', 503);
  });
});

describe('an answer the schema rejects', () => {
  it('is reported once, as itself, and stays in the section', async () => {
    stubReplies({ status: 200, body: [{ unexpected: true }] });

    await renderPage(<Certifications />);

    expect(await screen.findByText("Couldn't load certifications right now.")).toBeInTheDocument();
    expectShellIntact('My Certifications');
    expect(h.reportError).toHaveBeenCalledTimes(1);
    expect(h.reportError).toHaveBeenCalledWith(expect.any(ValidationError));
  });
});
