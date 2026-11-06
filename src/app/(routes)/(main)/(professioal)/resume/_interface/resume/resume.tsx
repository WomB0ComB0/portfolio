import 'server-only';
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
 * @file The /resume page, rendered on the server: the active resume's PDF in a frame with a link
 * to open it, or a calm note when none is published. A failed load is not caught here; it reaches
 * the route's error page inside the shell.
 */

import { ExternalLink, FileText } from 'lucide-react';
import type { JSX, ReactNode } from 'react';
import { PageHeader } from '@/components/custom/page-header';
import { MagicCard } from '@/components/magicui/magic-card';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { Resume as ResumeDocument } from '@/hooks/sanity/schemas';
import { cn } from '@/lib/utils';

const BASE_CDN_URL = 'https://cdn.sanity.io/files/34jrnkds/production/';
const DEFAULT_TITLE = 'Resume';
const NOT_AVAILABLE = 'N/A';
/** A Sanity `date` value: a calendar day with no time or zone. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
/** Always in UTC, so the day shown is the day stored wherever the page renders. */
const LAST_UPDATED_FORMAT = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'long',
  timeZone: 'UTC',
});

const PAGE_CLASS = 'relative container mx-auto px-4 py-8 min-h-screen';
const SECTION_CLASS =
  'z-20 flex flex-col w-full justify-between mt-8 sm:mt-16 lg:mt-0 md:mt-0 mb-10 mx-auto';
/**
 * hover:border-primary overrides MagicCard's hover:border-hairline-strong: pointing at the PDF
 * iframe hovers the card the whole time it is read, and the purple border turned grey.
 */
const VIEWER_CARD_CLASS =
  'w-full max-w-4xl mx-auto border-primary hover:border-primary rounded-xl overflow-hidden';
/** The PDF frame; the loading skeleton has the same box. */
const FRAME_CLASS =
  'relative w-full h-[70vh] min-h-[500px] rounded-lg border-2 border-primary overflow-hidden bg-background';

/** The PDF's CDN URL, built from its file reference ('file-<id>-pdf') as it always has been. */
function pdfUrlOf(resume: ResumeDocument): string | undefined {
  const ref = resume.pdfFile.asset._ref;
  return ref ? `${BASE_CDN_URL}${ref.split('-').slice(1, 2).join('-')}.pdf` : undefined;
}

/**
 * "Last updated" as a long US date. A YYYY-MM-DD value is read as that day at UTC midnight, so it
 * never shows as the day before in US time zones; a full timestamp shows its UTC day.
 */
function formatLastUpdated(lastUpdated: string): string {
  const date = new Date(DATE_ONLY.test(lastUpdated) ? `${lastUpdated}T00:00:00Z` : lastUpdated);
  return Number.isNaN(date.getTime()) ? NOT_AVAILABLE : LAST_UPDATED_FORMAT.format(date);
}

const PageFrame = ({ children }: { children: ReactNode }): JSX.Element => (
  <div className={PAGE_CLASS}>
    <section className={SECTION_CLASS}>{children}</section>
  </div>
);

/** No resume is published (or it has no PDF). A state, not an error: no warning colours. */
const NoResume = (): JSX.Element => (
  <PageFrame>
    <PageHeader title={DEFAULT_TITLE} icon={<FileText />} />
    <Card className="w-full max-w-4xl mx-auto bg-card/40 backdrop-blur-md border-white/10 rounded-xl overflow-hidden">
      <CardContent className="p-8 text-center">
        <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" aria-hidden="true" />
        <p className="text-lg font-medium text-foreground">No resume is published right now</p>
        <p className="mt-2 text-muted-foreground">Please check back later.</p>
      </CardContent>
    </Card>
  </PageFrame>
);

/** The PDF in a frame, with a link to open it in a new tab beside it. */
const ResumeViewer = ({ pdfUrl }: { pdfUrl: string }): JSX.Element => (
  <MagicCard
    className={`${VIEWER_CARD_CLASS} shadow-lg hover:shadow-primary/20 transition-shadow duration-300`}
  >
    <CardContent className="p-4 sm:p-6">
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            buttonVariants({ variant: 'outline', size: 'sm' }),
            'w-full sm:w-auto text-muted-foreground border-primary text-xs sm:text-sm transition-all hover:-translate-y-0.5',
          )}
        >
          <ExternalLink className="mr-2 h-3 w-3 sm:h-4 sm:w-4" aria-hidden="true" />
          Open PDF
        </a>
      </div>

      <div className={FRAME_CLASS}>
        <iframe
          title="Resume PDF"
          src={`${pdfUrl}#view=FitH`}
          className="w-full h-full"
          loading="lazy"
        />
      </div>

      <div className="mt-4 text-center">
        <p className="text-muted-foreground text-xs sm:text-sm">
          If the PDF viewer doesn't load,{' '}
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:text-primary/90 underline decoration-primary transition-colors"
          >
            click here to open in a new tab
          </a>
          {'.'}
        </p>
        <p className="text-muted-foreground mt-2 text-[11px]">Filename: {pdfUrl}</p>
      </div>
    </CardContent>
  </MagicCard>
);

export interface ResumeProps {
  /** The active resume, or null when none is published. */
  readonly resume: ResumeDocument | null;
}

/** The active resume's PDF with a link to open it, or a calm note when none is published. */
export const Resume = ({ resume }: ResumeProps): JSX.Element => {
  const pdfUrl = resume ? pdfUrlOf(resume) : undefined;
  if (!resume || !pdfUrl) return <NoResume />;

  return (
    <PageFrame>
      <div>
        <PageHeader
          title={resume.title || DEFAULT_TITLE}
          description={`Last updated: ${formatLastUpdated(resume.lastUpdated)}`}
          icon={<FileText />}
        />
        <ResumeViewer pdfUrl={pdfUrl} />
      </div>
    </PageFrame>
  );
};
Resume.displayName = 'Resume';

/**
 * The page while it loads (loading.tsx): the real header, so its h1 is on screen from the first
 * flush (even with JavaScript off), over a frame the size of the PDF's. It has the default title;
 * a published resume's own title, if it has one, replaces it in place. Only what needs the data is
 * a placeholder: the "Last updated" line and the viewer.
 */
export const ResumeSkeleton = (): JSX.Element => (
  <PageFrame>
    <div>
      <PageHeader title={DEFAULT_TITLE} icon={<FileText />} />
      <output className="block" aria-label="Loading resume">
        {/*
          The "Last updated" line. PageHeader draws its description above its bottom padding
          (page-header.css: pb-4); with no description that padding ends the header. So the bar
          is one description line tall (text-sm, md:text-base) and is lifted by that padding with
          relative positioning, which moves it without moving the boxes after it: it sits where
          the date will, and the frame below does not shift when the page arrives.
        */}
        <Skeleton className="relative -top-4 mx-auto h-5 md:h-6 w-56" />
        <Card className={`${VIEWER_CARD_CLASS} shadow-lg`}>
          <CardContent className="p-4 sm:p-6">
            <Skeleton className="mb-4 sm:mb-6 h-8 w-full sm:w-28" />
            <Skeleton className={cn(FRAME_CLASS, 'bg-primary/10')} />
          </CardContent>
        </Card>
      </output>
    </div>
  </PageFrame>
);
ResumeSkeleton.displayName = 'ResumeSkeleton';

export default Resume;
