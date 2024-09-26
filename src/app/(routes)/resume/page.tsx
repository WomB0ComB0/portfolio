'use client';

import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, ExternalLink } from 'lucide-react';
import React, { useEffect, useState } from 'react';

export default function ResumePage() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Layout>
      <div className="relative container mx-auto px-4 py-8 min-h-screen">
        <section className="z-20 flex flex-col w-full justify-between mt-8 sm:mt-16 lg:mt-0 md:mt-0 prose mb-10 mx-auto">
          <Card className="w-full max-w-4xl mx-auto bg-[#1E1E1E] border-purple-800 rounded-xl overflow-hidden shadow-lg">
            <CardContent className="p-4 sm:p-6">
              <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <p className="text-gray-300 text-sm sm:text-base">
                  My professional resume and portfolio
                </p>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto bg-purple-900 hover:bg-purple-800 text-purple-300 border-purple-700 text-xs sm:text-sm"
                    onClick={() =>
                      window.open(
                        'https://docs.google.com/document/d/1BbnVKQLGoIZHTx6J14euqpxq2E_b95zEfi8r0jfbDZA/export?format=pdf',
                        '_blank',
                      )
                    }
                  >
                    <Download className="mr-2 h-3 w-3 sm:h-4 sm:w-4" /> Download PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto bg-purple-900 hover:bg-purple-800 text-purple-300 border-purple-700 text-xs sm:text-sm"
                    onClick={() =>
                      window.open(
                        'https://docs.google.com/document/d/1BbnVKQLGoIZHTx6J14euqpxq2E_b95zEfi8r0jfbDZA/edit?usp=sharing',
                        '_blank',
                      )
                    }
                  >
                    <ExternalLink className="mr-2 h-3 w-3 sm:h-4 sm:w-4" /> Open in Google Docs
                  </Button>
                </div>
              </div>
              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-[300px] sm:h-[400px] md:h-[500px] lg:h-[600px] w-full bg-purple-900/20" />
                  <div className="flex justify-center">
                    <Skeleton className="h-3 sm:h-4 w-24 sm:w-32 bg-purple-900/20" />
                  </div>
                </div>
              ) : (
                <>
                  <iframe
                    src="https://docs.google.com/document/d/1BbnVKQLGoIZHTx6J14euqpxq2E_b95zEfi8r0jfbDZA/pub?embedded=true"
                    className="w-full h-[300px] sm:h-[400px] md:h-[500px] lg:h-[600px] border-2 border-purple-800 rounded-lg"
                    title="Mike Odnis Resume"
                  />
                  <p className="text-center text-gray-400 mt-4 text-xs sm:text-sm">
                    Viewing Mike Odnis's Resume - Last updated: {new Date().toLocaleDateString()}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </Layout>
  );
}
