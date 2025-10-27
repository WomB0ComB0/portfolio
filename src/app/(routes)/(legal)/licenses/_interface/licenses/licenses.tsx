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

import { MagicCard } from '@/components';
import Layout from '@/components/layout/layout';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink, FileCode, FileText, Image } from 'lucide-react';
import Link from 'next/link';
import type { JSX } from 'react';
import type { LicenseCardProps } from './licenses.types';
import { emailHref } from "@/constants";

/**
 * Renders a card displaying license details for a specific content type.
 * Clicking the license name opens the license URL in a new tab.
 *
 * @function
 * @param {LicenseCardProps} props - Properties for license card rendering.
 * @returns {JSX.Element} The rendered license card.
 * @author Mike Odnis
 * @see LicenseCardProps
 * @web
 * @version 1.0.0
 * @example
 * <LicenseCard
 *   title="Blog Posts"
 *   description="All blog posts are licensed under CC BY 4.0."
 *   licenseName="CC BY 4.0"
 *   licenseUrl="https://creativecommons.org/licenses/by/4.0/"
 *   icon={<FileText className="h-6 w-6" />}
 * />
 */
const LicenseCard = ({
  title,
  description,
  licenseName,
  licenseUrl,
  icon,
}: LicenseCardProps): JSX.Element => (
  <MagicCard className="border-border hover:border-primary transition-colors">
    <CardHeader>
      <div className="flex items-center gap-3 mb-2">
        <div className="text-primary">{icon}</div>
        <CardTitle className="text-2xl text-foreground">{title}</CardTitle>
      </div>
      <CardDescription className="text-muted-foreground text-base">{description}</CardDescription>
    </CardHeader>
    <CardContent>
      <Link
        href={licenseUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-primary hover:text-primary-foreground transition-colors group"
      >
        <span className="font-semibold">{licenseName}</span>
        <ExternalLink className="h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
      </Link>
    </CardContent>
  </MagicCard>
);

/**
 * Renders the full content licensing documentation page for the portfolio.
 * This section includes:
 * - An overview of licensing principles
 * - Cards for each license category
 * - Third-party dependency license summary
 * - A contact prompt for additional licensing questions
 *
 * This component is the main interface for displaying license and permissions information within the project.
 *
 * @function
 * @returns {JSX.Element} The rendered licensing documentation interface.
 * @throws {Error} If critical licensing data is not available (not expected in static usage).
 * @author Mike Odnis
 * @see LicenseCard
 * @see https://github.com/WomB0ComB0/portfolio
 * @web
 * @version 1.0.0
 * @example
 * <Licenses />
 */
export const Licenses = (): JSX.Element => {
  return (
    <Layout>
      <section className="container mx-auto px-4 py-12 max-w-5xl">
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-4 text-foreground">Content Licenses</h1>
          <p className="text-lg text-muted-foreground">
            Different types of content on this site are licensed under different terms to promote
            sharing, collaboration, and proper attribution.
          </p>
        </div>

        <div className="space-y-6">
          <LicenseCard
            title="Blog Posts"
            description="All blog posts and written articles are licensed under Creative Commons Attribution 4.0 International License. You are free to share and adapt the material as long as appropriate credit is given."
            licenseName="CC BY 4.0"
            licenseUrl="https://creativecommons.org/licenses/by/4.0/"
            icon={<FileText className="h-6 w-6" />}
          />

          <LicenseCard
            title="Code & Lab Projects"
            description="All code examples, projects, and technical implementations in the lab section are licensed under Apache License 2.0. You may use, modify, and distribute the code for any purpose, including commercial applications."
            licenseName="Apache License 2.0"
            licenseUrl="https://www.apache.org/licenses/LICENSE-2.0"
            icon={<FileCode className="h-6 w-6" />}
          />

          <LicenseCard
            title="Photography & Images"
            description="All photographs and original images are licensed under Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License. You may share and adapt the photos for non-commercial purposes with proper attribution."
            licenseName="CC BY-NC-SA 4.0"
            licenseUrl="https://creativecommons.org/licenses/by-nc-sa/4.0/"
            icon={<Image className="h-6 w-6" />}
          />
        </div>

        <MagicCard className="mt-12 border-border">
          <CardHeader>
            <CardTitle className="text-xl text-foreground">Third-Party Licenses</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground space-y-4">
            <p>
              This website is built with various open-source libraries and frameworks. We are
              grateful to the open-source community for their contributions.
            </p>
            <p>
              Major dependencies include Next.js (MIT License), React (MIT License), TailwindCSS
              (MIT License), and many others. Each dependency maintains its own license terms.
            </p>
            <p className="text-sm text-muted-foreground">
              For a complete list of dependencies and their licenses, please refer to the{' '}
              <code className="bg-muted px-2 py-1 rounded text-primary">package.json</code> file in
              the project repository.
            </p>
          </CardContent>
        </MagicCard>

        <div className="mt-8 p-6 bg-muted rounded-lg border border-border">
          <h3 className="text-lg font-semibold text-foreground mb-2">Questions or Permissions</h3>
          <p className="text-muted-foreground">
            If you have questions about these licenses or need special permissions beyond what is
            granted, please feel free to{' '}
            <a
              href={emailHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary-foreground underline"
            >
              contact me
            </a>
            .
          </p>
        </div>
      </section>
    </Layout>
  );
};
Licenses.displayName = 'Licenses';
export default Licenses;
