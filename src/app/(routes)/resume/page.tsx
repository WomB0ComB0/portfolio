'use client';

import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, ExternalLink } from 'lucide-react';
import React from 'react';
import { useEffect, useState } from 'react';

export default function ResumePage() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Layout>
      <div className="relative container mx-auto px-4 py-8 min-h-screen">
        <section className="z-20 flex flex-col w-full justify-between mt-16 lg:mt-0 md:mt-0 prose mb-10 mx-auto">
          <Card className="w-full max-w-4xl mx-auto bg-[#1E1E1E] border-purple-800 rounded-xl overflow-hidden shadow-lg">
            <CardContent className="p-6">
              <div className="mb-6 flex justify-between items-center">
                <p className="text-gray-300">My professional resume and portfolio</p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-purple-900 hover:bg-purple-800 text-purple-300 border-purple-700"
                    onClick={() =>
                      window.open(
                        'https://docs.google.com/document/d/1BbnVKQLGoIZHTx6J14euqpxq2E_b95zEfi8r0jfbDZA/export?format=pdf',
                        '_blank',
                      )
                    }
                  >
                    <Download className="mr-2 h-4 w-4" /> Download PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-purple-900 hover:bg-purple-800 text-purple-300 border-purple-700"
                    onClick={() =>
                      window.open(
                        'https://docs.google.com/document/d/1BbnVKQLGoIZHTx6J14euqpxq2E_b95zEfi8r0jfbDZA/edit?usp=sharing',
                        '_blank',
                      )
                    }
                  >
                    <ExternalLink className="mr-2 h-4 w-4" /> Open in Google Docs
                  </Button>
                </div>
              </div>
              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-[600px] w-full bg-purple-900/20" />
                  <div className="flex justify-center">
                    <Skeleton className="h-4 w-32 bg-purple-900/20" />
                  </div>
                </div>
              ) : (
                <>
                  <iframe
                    src="https://docs.google.com/document/d/1BbnVKQLGoIZHTx6J14euqpxq2E_b95zEfi8r0jfbDZA/pub?embedded=true"
                    className="w-full h-[600px] border-2 border-purple-800 rounded-lg"
                    title="Mike Odnis Resume"
                  />
                  <p className="text-center text-gray-400 mt-4">
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
