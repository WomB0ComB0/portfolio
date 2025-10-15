'use client';

import { Download, ExternalLink, FileText } from 'lucide-react';
import { motion } from 'motion/react';

import Layout from '@/components/layout/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import { useSanityResume, type Resume as ResumeType } from '@/hooks';

export function Resume() {
  const { data: resume, isLoading, error } = useSanityResume();

  // Type-safe access to resume data
  const typedResume = resume as ResumeType | undefined;
  const pdfUrl = typedResume?.pdfFile?.url;
  const lastUpdated = typedResume?.lastUpdated
    ? new Date(typedResume.lastUpdated).toLocaleDateString()
    : 'N/A';

  if (isLoading) {
    return (
      <Layout>
        <div className="relative container mx-auto px-4 py-8 min-h-screen">
          <section className="z-20 flex flex-col w-full justify-between mt-8 sm:mt-16 lg:mt-0 md:mt-0 mb-10 mx-auto">
            <Card className="w-full max-w-4xl mx-auto bg-[#1E1E1E] border-purple-800 rounded-xl overflow-hidden shadow-lg">
              <CardContent className="p-4 sm:p-6">
                <div className="space-y-4">
                  <Skeleton className="h-[300px] sm:h-[400px] md:h-[500px] lg:h-[600px] w-full bg-purple-900/20" />
                  <div className="flex justify-center">
                    <Skeleton className="h-3 sm:h-4 w-24 sm:w-32 bg-purple-900/20" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </Layout>
    );
  }

  if (error || !resume || !pdfUrl) {
    return (
      <Layout>
        <div className="relative container mx-auto px-4 py-8 min-h-screen">
          <section className="z-20 flex flex-col w-full justify-between mt-8 sm:mt-16 lg:mt-0 md:mt-0 mb-10 mx-auto">
            <Card className="w-full max-w-4xl mx-auto bg-gradient-to-br from-red-900/20 to-red-800/20 border-red-800 rounded-xl overflow-hidden shadow-lg">
              <CardContent className="p-8 text-center">
                <FileText className="h-16 w-16 text-red-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-red-400 mb-2">Resume Not Available</h2>
                <p className="text-gray-400">
                  Sorry, the resume is currently unavailable. Please check back later.
                </p>
              </CardContent>
            </Card>
          </section>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="relative container mx-auto px-4 py-8 min-h-screen">
        <section className="z-20 flex flex-col w-full justify-between mt-8 sm:mt-16 lg:mt-0 md:mt-0 mb-10 mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Card className="w-full max-w-4xl mx-auto bg-[#1E1E1E] border-purple-800 rounded-xl overflow-hidden shadow-lg hover:shadow-purple-500/20 transition-shadow duration-300">
              <CardContent className="p-4 sm:p-6">
                <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-purple-300 mb-1">
                      {typedResume?.title || 'Resume'}
                    </h1>
                    <p className="text-gray-400 text-sm">Last updated: {lastUpdated}</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto bg-purple-900 hover:bg-purple-800 text-purple-300 border-purple-700 text-xs sm:text-sm transition-all hover:-translate-y-0.5"
                      onClick={() => window.open(pdfUrl, '_blank')}
                    >
                      <Download className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                      Download PDF
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto bg-purple-900 hover:bg-purple-800 text-purple-300 border-purple-700 text-xs sm:text-sm transition-all hover:-translate-y-0.5"
                      onClick={() => window.open(pdfUrl, '_blank')}
                    >
                      <ExternalLink className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                      Open PDF
                    </Button>
                  </div>
                </div>

                <div className="relative w-full h-[70vh] min-h-[500px] rounded-lg border-2 border-purple-800 overflow-hidden bg-gray-900">
                  <iframe
                    title="Resume PDF"
                    src={`${pdfUrl}#view=FitH`}
                    className="w-full h-full"
                    loading="lazy"
                  />
                </div>

                <div className="mt-4 text-center">
                  <p className="text-gray-400 text-xs sm:text-sm">
                    If the PDF viewer doesn't load,{' '}
                    <a
                      href={pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-400 hover:text-purple-300 underline decoration-purple-500 transition-colors"
                    >
                      click here to open in a new tab
                    </a>
                    .
                  </p>
                  {typedResume?.pdfFile?.originalFilename && (
                    <p className="text-gray-500 mt-2 text-[11px]">
                      Filename: {typedResume.pdfFile.originalFilename}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </section>
      </div>
    </Layout>
  );
}
