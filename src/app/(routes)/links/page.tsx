'use client';

import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useEffect, useRef, useState } from 'react';

export default function LinksPage() {
  const [loaded, setLoaded] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // If the iframe doesn't load within 1.5s, show the fallback UI
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 1500);
    return () => clearTimeout(t);
  }, []);

  return (
    <Layout>
      <div className="container px-4 py-8 min-h-screen flex flex-col items-center">
        <Card className="w-full max-w-md mx-auto bg-gradient-to-br from-purple-900 to-purple-600 border-none shadow-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-4xl font-bold text-center text-white">My Links</CardTitle>
            <CardDescription className="text-center text-purple-200">
              Powered by Linktree
            </CardDescription>
          </CardHeader>

          <CardContent className="px-5">
            {/* Responsive 9:16 container */}
            <div className="relative w-full aspect-[9/16] rounded-xl overflow-hidden ring-1 ring-purple-700/40">
              <iframe
                ref={iframeRef}
                src="https://linktr.ee/mikeodnis"
                title="Linktree — Mike Odnis"
                className="absolute inset-0 h-full w-full border-0"
                loading="lazy"
                // note: avoid over-restrictive sandbox that can break 3P UIs
                // allow common features Linktree may use:
                allow="clipboard-write; fullscreen; geolocation; microphone; camera; autoplay; payment"
                referrerPolicy="no-referrer-when-downgrade"
                onLoad={() => setLoaded(true)}
              />
            </div>

            {/* Fallback if iframe is blocked or fails */}
            {timedOut && !loaded && (
              <div className="mt-4 text-center">
                <p className="text-sm text-purple-200">
                  If the embed didn’t load, your browser or the site may block iframes for security.
                </p>
                <Button asChild variant="secondary" className="mt-2">
                  <a
                    href="https://linktr.ee/mikeodnis"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open my Linktree
                  </a>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
