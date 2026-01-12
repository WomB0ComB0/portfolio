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

import { WifiOff } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { JSX } from 'react';
import { Layout } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Offline',
  description: 'You are currently offline.',
};

/**
 * Renders a user-friendly page indicating that the user is offline.
 *
 * This component is designed to be displayed as a fallback when a user
 * without a network connection attempts to access a page that has not been
 * cached by the service worker.
 *
 * @returns {JSX.Element} The offline page component.
 */
const OfflinePage = (): JSX.Element => {
  return (
    <Layout>
      <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center p-4">
        <Card className="max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <WifiOff className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">You're (or were) Offline</CardTitle>
            <CardDescription>
              It seems you've lost your connection. This page can't be displayed right now.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-6 text-muted-foreground">
              Please check your network connection and try again. Previously visited pages might
              still be accessible.
            </p>
            <Button asChild>
              <Link href="/">Go to Homepage</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default OfflinePage;
