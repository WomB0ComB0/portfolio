'use client';

import { ExternalLink, FileCode, FileText, Image } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface LicenseCardProps {
  title: string;
  description: string;
  licenseName: string;
  licenseUrl: string;
  icon: React.ReactNode;
}

const LicenseCard = ({ title, description, licenseName, licenseUrl, icon }: LicenseCardProps) => (
  <Card className="bg-[#1E1E1E] border-purple-800 hover:border-purple-600 transition-colors">
    <CardHeader>
      <div className="flex items-center gap-3 mb-2">
        <div className="text-purple-400">{icon}</div>
        <CardTitle className="text-2xl text-purple-300">{title}</CardTitle>
      </div>
      <CardDescription className="text-gray-400 text-base">{description}</CardDescription>
    </CardHeader>
    <CardContent>
      <Link
        href={licenseUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors group"
      >
        <span className="font-semibold">{licenseName}</span>
        <ExternalLink className="h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
      </Link>
    </CardContent>
  </Card>
);

export const Licenses = () => {
  return (
    <section className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-4 text-purple-300">Content Licenses</h1>
        <p className="text-lg text-gray-400">
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

      <Card className="mt-12 bg-[#1E1E1E] border-purple-800">
        <CardHeader>
          <CardTitle className="text-xl text-purple-300">Third-Party Licenses</CardTitle>
        </CardHeader>
        <CardContent className="text-gray-400 space-y-4">
          <p>
            This website is built with various open-source libraries and frameworks. We are grateful
            to the open-source community for their contributions.
          </p>
          <p>
            Major dependencies include Next.js (MIT License), React (MIT License), TailwindCSS (MIT
            License), and many others. Each dependency maintains its own license terms.
          </p>
          <p className="text-sm text-gray-500">
            For a complete list of dependencies and their licenses, please refer to the{' '}
            <code className="bg-[#2a2a2a] px-2 py-1 rounded text-purple-400">package.json</code>{' '}
            file in the project repository.
          </p>
        </CardContent>
      </Card>

      <div className="mt-8 p-6 bg-[#2a2a2a] rounded-lg border border-purple-900">
        <h3 className="text-lg font-semibold text-purple-300 mb-2">Questions or Permissions</h3>
        <p className="text-gray-400">
          If you have questions about these licenses or need special permissions beyond what is
          granted, please feel free to{' '}
          <Link href="/contact" className="text-purple-400 hover:text-purple-300 underline">
            contact me
          </Link>
          .
        </p>
      </div>
    </section>
  );
};
Licenses.displayName = 'Licenses';

export default Licenses;
