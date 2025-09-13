'use client';

import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink, Globe } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export default function LinksPage() {
  const [loaded, setLoaded] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [error, setError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // If the iframe doesn't load within 3s, show the fallback UI
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 3000);
    return () => clearTimeout(t);
  }, []);

  const handleIframeError = () => {
    setError(true);
  };

  const handleIframeLoad = () => {
    setLoaded(true);
  };

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
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-top-navigation-by-user-activation allow-downloads"
                allow="clipboard-write; fullscreen; geolocation; microphone; camera; autoplay; payment; web-share; clipboard-read; accelerometer; gyroscope"
                referrerPolicy="strict-origin-when-cross-origin"
                onLoad={handleIframeLoad}
                onError={handleIframeError}
                style={{
                  background: 'transparent',
                }}
                // Try to bypass some restrictions
                data-src="https://linktr.ee/mikeodnis"
              />

              {/* Loading overlay */}
              {!loaded && !error && (
                <div className="absolute inset-0 bg-purple-900/80 flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                    <p className="text-white text-sm">Loading Linktree...</p>
                  </div>
                </div>
              )}
            </div>

            {/* Fallback if iframe is blocked or fails */}
            {(timedOut || error) && !loaded && (
              <div className="mt-4 text-center">
                <p className="text-sm text-purple-200 mb-3">
                  Linktree blocks iframe embedding for security. Click below to open it directly.
                </p>
                <Button asChild variant="secondary" className="mt-2">
                  <a
                    href="https://linktr.ee/mikeodnis"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2"
                  >
                    <Globe className="h-4 w-4" />
                    Open my Linktree
                    <ExternalLink className="h-4 w-4" />
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
