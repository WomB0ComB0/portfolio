'use client';

import { ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';
import Layout from '@/components/layout/layout';
import { Button } from '@/components/ui/button';
import { useSanityExperiences } from '@/hooks';
import { urlFor } from '@/lib/sanity/client';

interface ExperienceDetailProps {
  params: { id: string };
}

const ExperienceDetailContent = ({ id }: { id: string }) => {
  const { data: experiences } = useSanityExperiences();
  const experienceItem = (experiences as any[]).find((exp: any) => exp._id === id);

  if (!experienceItem) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-3xl font-bold text-purple-300 mb-4">Experience Not Found</h1>
        <p className="text-gray-400 mb-8">
          The experience item you are looking for does not exist.
        </p>
        <Button
          asChild
          variant="outline"
          className="text-purple-300 border-purple-700 hover:bg-purple-800"
        >
          <Link href="/experience">
            <ArrowLeft className="mr-2 h-5 w-5" /> Back to Experience
          </Link>
        </Button>
      </div>
    );
  }

  const period = experienceItem.current
    ? `${new Date(experienceItem.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - Present`
    : `${new Date(experienceItem.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - ${experienceItem.endDate ? new Date(experienceItem.endDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Present'}`;

  return (
    <section className="w-full max-w-3xl mx-auto bg-[#1E1E1E] border border-purple-800 rounded-xl overflow-hidden">
      <article className="p-6 md:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row items-start gap-6 mb-6">
          {experienceItem.logo && (
            <div className="flex-shrink-0 w-24 h-24 relative">
              <Image
                src={urlFor(experienceItem.logo).width(96).height(96).url()}
                alt={`${experienceItem.company} logo`}
                width={96}
                height={96}
                className="rounded-lg object-contain bg-white p-1"
              />
            </div>
          )}
          <div className="flex-grow">
            <h1 className="text-3xl font-bold text-purple-300 mb-1">
              {experienceItem.position}
            </h1>
            <h2 className="text-xl font-semibold text-purple-400 mb-1">
              {experienceItem.company}
            </h2>
            <p className="text-sm text-gray-500">{period}</p>
            {experienceItem.location && (
              <p className="text-sm text-gray-500">{experienceItem.location}</p>
            )}
            {experienceItem.companyUrl && (
              <Link
                href={experienceItem.companyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-purple-400 hover:text-purple-300"
              >
                Visit Company Website →
              </Link>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-xl font-semibold text-purple-300 mb-2">Description</h3>
          <p className="text-gray-300 whitespace-pre-line">{experienceItem.description}</p>
        </div>

        {experienceItem.responsibilities &&
          experienceItem.responsibilities.length > 0 && (
            <div>
              <h3 className="text-xl font-semibold text-purple-300 mb-2">
                Key Responsibilities
              </h3>
              <ul className="list-disc list-inside space-y-1 text-gray-300">
                {experienceItem.responsibilities.map((responsibility: string, index: number) => (
                  <li key={index}>{responsibility}</li>
                ))}
              </ul>
            </div>
          )}        {experienceItem.technologies && experienceItem.technologies.length > 0 && (
            <div>
              <h3 className="text-xl font-semibold text-purple-300 mb-2">
                Technologies Used
              </h3>
              <div className="flex flex-wrap gap-2">
                {experienceItem.technologies.map((tech: string, index: number) => (
                  <span
                    key={index}
                    className="px-3 py-1 text-sm bg-purple-700 text-purple-200 rounded-full"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          )}

        <div className="mt-8 pt-6 border-t border-purple-700">
          <Button
            asChild
            variant="outline"
            className="text-purple-300 border-purple-700 hover:bg-purple-800"
          >
            <Link href="/experience">
              <ArrowLeft className="mr-2 h-5 w-5" /> Back to Experience
            </Link>
          </Button>
        </div>
      </article>
    </section>
  );
};

export const ExperienceDetail = ({ params }: ExperienceDetailProps) => {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <Suspense
          fallback={
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-500 border-r-transparent"></div>
              <p className="text-gray-400 mt-4">Loading experience details...</p>
            </div>
          }
        >
          <ExperienceDetailContent id={params.id} />
        </Suspense>
      </div>
    </Layout>
  );
};
