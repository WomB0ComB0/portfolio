'use client';


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

import { MagicCard, PageHeader } from '@/components';
import Layout from '@/components/layout/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { type Resume as ResumeType, useSanityResume } from '@/hooks';
import { ExternalLink, FileText } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';

const BASE_CDN_URL = 'https://cdn.sanity.io/files/34jrnkds/production/';

/**
 * Renders the user's resume in PDF format with options to download and view the file.
 * Handles loading states (with skeleton), error states (with error messaging), and main content.
 * Serves as the principal resume interface for the portfolio project.
 *
 * @function
 * @public
 * @web
 * @author Mike Odnis
 * @see {@link https://github.com/WomB0ComB0/portfolio|Project Repository (portfolio)}
 * @see ResumeType
 * @version 1.0.0
 * @returns {JSX.Element} The resume view, including skeleton, error and PDF embed states.
 * @throws {Error} If resume data loading fails or no PDF URL is available.
 * @example
 * // Usage within a Next.js page
 * <Resume />
 */
export const Resume = () => {
  /**
   * Resume data loading hook.
   * @readonly
   * @type {{ data: ResumeType | undefined, isLoading: boolean, error: unknown }}
   */
  const { data: resume, isLoading, error } = useSanityResume();

  /**
   * Type-safe, optional access to resume data.
   * @readonly
   * @type {ResumeType|undefined}
   */
  const typedResume = resume as ResumeType | undefined;
  /**
   * PDF URL for the resume (if available).
   * @readonly
   * @type {string|undefined}
   */
  const pdfUrl = typedResume?.pdfFile?.asset._ref
    ? `${BASE_CDN_URL}${typedResume.pdfFile.asset._ref.split('-').slice(1, 2).join('-')}.pdf`
    : undefined;
  /**
   * Last updated date, formatted for display.
   * @readonly
   * @type {string}
   */
  const lastUpdated = typedResume?.lastUpdated
    ? new Date(typedResume.lastUpdated).toLocaleDateString()
    : 'N/A';
  // Render loading state (skeleton UI)
  if (isLoading) {
    return (
      <Layout>
        <div className="relative container mx-auto px-4 py-8 min-h-screen">
          <section className="z-20 flex flex-col w-full justify-between mt-8 sm:mt-16 lg:mt-0 md:mt-0 mb-10 mx-auto">
            <Card className="w-full max-w-4xl mx-auto bg-card border-primary rounded-xl overflow-hidden shadow-lg">
              <CardContent className="p-4 sm:p-6">
                <div className="space-y-4">
                  <Skeleton className="h-[300px] sm:h-[400px] md:h-[500px] lg:h-[600px] w-full bg-accent" />
                  <div className="flex justify-center">
                    <Skeleton className="h-3 sm:h-4 w-24 sm:w-32 bg-accent" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </Layout>
    );
  }

  // Render error state
  if (error || !resume || !pdfUrl) {
    return (
      <Layout>
        <div className="relative container mx-auto px-4 py-8 min-h-screen">
          <section className="z-20 flex flex-col w-full justify-between mt-8 sm:mt-16 lg:mt-0 md:mt-0 mb-10 mx-auto">
            <Card className="w-full max-w-4xl mx-auto bg-linear-to-b from-destructive/20 to-destructive/20 border-destructive rounded-xl overflow-hidden shadow-lg">
              <CardContent className="p-8 text-center">
                <FileText className="h-16 w-16 text-destructive-foreground mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-destructive-foreground mb-2">
                  Resume Not Available
                </h2>
                <p className="text-destructive-foreground/80">
                  Sorry, the resume is currently unavailable. Please check back later.
                </p>
              </CardContent>
            </Card>
          </section>
        </div>
      </Layout>
    );
  }

  // Render main resume PDF content
  return (
    <Layout>
      <div className="relative container mx-auto px-4 py-8 min-h-screen">
        <section className="z-20 flex flex-col w-full justify-between mt-8 sm:mt-16 lg:mt-0 md:mt-0 mb-10 mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <PageHeader
              title={typedResume?.title || 'Resume'}
              description={`Last updated: ${lastUpdated}`}
              icon={<FileText />}
            />
            <MagicCard className="w-full max-w-4xl mx-auto border-primary rounded-xl overflow-hidden shadow-lg hover:shadow-primary/20 transition-shadow duration-300">
              <CardContent className="p-4 sm:p-6">
                <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    {/**
                     * Open Resume Button
                     * @param {MouseEvent} e - The click event
                     * @returns {void}
                     */}
                    <Button variant="outline" size="sm">
                      <Link
                        href={pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center w-full sm:w-auto text-muted-foreground border-primary text-xs sm:text-sm transition-all hover:-translate-y-0.5 flex-row"
                      >
                        <ExternalLink className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                        Open PDF
                      </Link>
                    </Button>
                  </div>
                </div>

                <div className="relative w-full h-[70vh] min-h-[500px] rounded-lg border-2 border-primary overflow-hidden bg-background">
                  {/**
                   * Embedded PDF iframe for resume.
                   * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe}
                   */}
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
                    .
                  </p>
                  {typedResume?.pdfFile && (
                    /**
                     * Render original PDF filename for download or verification.
                     * @readonly
                     * @type {string}
                     */
                    <p className="text-muted-foreground mt-2 text-[11px]">
                      Filename: {pdfUrl || 'resume.pdf'}
                    </p>
                  )}
                </div>
              </CardContent>
            </MagicCard>
          </motion.div>
        </section>
      </div>
    </Layout>
  );
};
Resume.displayName = 'Resume';
export default Resume;
