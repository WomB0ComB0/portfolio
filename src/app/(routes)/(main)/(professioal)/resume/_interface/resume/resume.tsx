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

import { ChevronDown, Download, ExternalLink } from 'lucide-react';
import type { JSX } from 'react';
import { EmptyState } from '@/components/console/empty-state';
import { PageShell } from '@/components/console/page-shell';
import { buttonVariants } from '@/components/ui/button';
import type { Resume as ResumeDocument } from '@/hooks/sanity/schemas';
import { cn } from '@/lib/utils';

const BASE_CDN_URL = 'https://cdn.sanity.io/files/34jrnkds/production/';
const DEFAULT_TITLE = 'Resume';
const DOWNLOAD_FILENAME = 'Mike-Odnis-Resume.pdf';
const DIRECT_NOTE_ID = 'resume-direct-note';
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const LAST_UPDATED_FORMAT = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'long',
  timeZone: 'UTC',
});
const ACTION_CLASS = 'h-auto min-h-11 max-w-full whitespace-normal px-4 py-2.5';
const FRAME_CLASS = 'overflow-hidden rounded-tile border border-hairline-strong bg-surface-1';
const PDF_CLASS = 'block h-[70vh] min-h-96 w-full border-0 @min-[48rem]/page:min-h-[36rem]';

/** Keep the original CDN address unchanged; never invent a PDF from another asset type. */
function pdfUrlOf(resume: ResumeDocument): string | undefined {
  const file = /^file-([A-Za-z0-9]+)-pdf$/u.exec(resume.pdfFile.asset._ref);
  return file?.[1] ? `${BASE_CDN_URL}${file[1]}.pdf` : undefined;
}

/** Sanity's documented dl parameter supplies Content-Disposition: attachment across origins. */
function downloadUrlOf(pdfUrl: string): string {
  const download = new URL(pdfUrl);
  download.searchParams.set('dl', DOWNLOAD_FILENAME);
  return download.href;
}

/** A stored date-only value must keep its own UTC day in every reader's timezone. */
function formatLastUpdated(lastUpdated: string): string {
  const date = new Date(DATE_ONLY.test(lastUpdated) ? `${lastUpdated}T00:00:00Z` : lastUpdated);
  return Number.isNaN(date.getTime()) ? 'N/A' : LAST_UPDATED_FORMAT.format(date);
}

function ResumeActions({ pdfUrl }: { readonly pdfUrl: string }): JSX.Element {
  return (
    <>
      <a
        href={downloadUrlOf(pdfUrl)}
        download={DOWNLOAD_FILENAME}
        className={cn(buttonVariants({ size: 'lg' }), ACTION_CLASS)}
      >
        <Download aria-hidden="true" />
        Download PDF
      </a>
      <a
        href={pdfUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-describedby={DIRECT_NOTE_ID}
        className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), ACTION_CLASS)}
      >
        <ExternalLink aria-hidden="true" />
        Open PDF
      </a>
    </>
  );
}

/** Always visible and selectable, including without JavaScript and on narrow/touch screens. */
function DirectPdfLink({ pdfUrl }: { readonly pdfUrl: string }): JSX.Element {
  return (
    <div className="min-w-0">
      <p className="tile-label text-muted-foreground">Direct PDF link</p>
      <a
        href={pdfUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-describedby={DIRECT_NOTE_ID}
        data-resume-direct-link=""
        draggable={false}
        className="mt-2 block max-w-full select-text rounded-sm font-mono text-sm leading-6 text-brand-ink underline decoration-(--brand-edge) underline-offset-4 [overflow-wrap:anywhere] hover:decoration-current"
      >
        {pdfUrl}
      </a>
      <p id={DIRECT_NOTE_ID} className="mt-2 tile-meta text-faint">
        Opens in a new tab. You can also copy this address if the preview does not display.
      </p>
    </div>
  );
}

export interface ResumeProps {
  readonly resume: ResumeDocument | null;
}

/** The published PDF remains the document; actions and the raw fallback need no client code. */
export const Resume = ({ resume }: ResumeProps): JSX.Element => {
  const pdfUrl = resume ? pdfUrlOf(resume) : undefined;
  if (!resume || !pdfUrl) {
    return (
      <PageShell title={DEFAULT_TITLE} sizing="container">
        <EmptyState title="No resume is published right now">Please check back later.</EmptyState>
      </PageShell>
    );
  }
  return (
    <PageShell
      title={resume.title || DEFAULT_TITLE}
      description={
        <span className="tile-meta">Last updated: {formatLastUpdated(resume.lastUpdated)}</span>
      }
      actions={<ResumeActions pdfUrl={pdfUrl} />}
      sizing="container"
    >
      <DirectPdfLink pdfUrl={pdfUrl} />
      <details data-resume-preview="" className={cn('group/resume-preview min-w-0', FRAME_CLASS)}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-tile px-4 py-3 tile-label text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus [&::-webkit-details-marker]:hidden">
          PDF preview
          <ChevronDown
            aria-hidden="true"
            className="size-4 shrink-0 group-open/resume-preview:rotate-180"
          />
        </summary>
        <iframe
          title="Resume PDF"
          src={`${pdfUrl}#view=FitH`}
          className={PDF_CLASS}
          loading="lazy"
        />
      </details>
    </PageShell>
  );
};
Resume.displayName = 'Resume';
