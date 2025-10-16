
'use client';

import Layout from '@/components/layout/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSanityExperiences } from '@/hooks';
import { urlFor } from '@/lib/sanity/client';
import type { Experience } from '@/lib/sanity/types';
import { Briefcase, ExternalLink } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';

/**
 * React component for rendering a list of professional experiences.
 * Retrieves and displays information about each experience, structured as cards.
 *
 * @function
 * @name ExperienceListContent
 * @memberof module:portfolio
 * @public
 * @web
 * @author Mike Odnis
 * @version 1.0.0
 * @see Experience, useSanityExperiences, urlFor
 * @returns {JSX.Element} React fragment containing the header and mapped experience cards.
 * @throws {Error} If data fetching from Sanity fails.
 * @example
 * <ExperienceListContent />
 */
const ExperienceListContent = () => {
  const { data: experiences } = useSanityExperiences();
  const experienceList = experiences as Experience[];

  return (
    <>
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-bold text-purple-300 flex items-center justify-center">
          <Briefcase className="mr-3 h-10 w-10" /> My Work Experience
        </h1>
        <p className="text-lg text-gray-400 mt-2">
          A summary of my professional roles and contributions.
        </p>
      </header>

      {experienceList && experienceList.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {experienceList.map((item) => {
            /**
             * Generates display period for the experience.
             * @type {string}
             * @readonly
             */
            const period = item.current
              ? `${new Date(item.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - Present`
              : `${new Date(item.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - ${item.endDate ? new Date(item.endDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Present'}`;

            return (
              <Card
                key={item._id}
                className="bg-[#1E1E1E] border-purple-800 rounded-xl overflow-hidden flex flex-col hover:shadow-xl hover:shadow-purple-500/40 transition-shadow duration-300"
              >
                <CardHeader className="flex flex-row items-start gap-4 p-6">
                  {item.logo && (
                    <div className="flex-shrink-0 w-16 h-16 relative">
                      <Image
                        src={urlFor(item.logo).width(64).height(64).url()}
                        alt={`${item.company} logo`}
                        width={64}
                        height={64}
                        className="rounded-md object-contain bg-white p-1"
                      />
                    </div>
                  )}
                  <div className="flex-grow">
                    <CardTitle className="text-xl font-semibold text-purple-300 mb-1">
                      {item.position}
                    </CardTitle>
                    <p className="text-md text-gray-400">{item.company}</p>
                    <p className="text-xs text-gray-500">{period}</p>
                    {item.location && <p className="text-xs text-gray-500">{item.location}</p>}
                  </div>
                </CardHeader>
                <CardContent className="p-6 flex-grow">
                  <p className="text-sm text-gray-300 mb-4 line-clamp-3">{item.description}</p>
                </CardContent>
                <div className="p-6 border-t border-purple-700 mt-auto">
                  <Button
                    asChild
                    variant="outline"
                    className="w-full bg-purple-800 hover:bg-purple-700 border-purple-700 text-purple-200"
                  >
                    <Link href={`/experience/${item._id}`} scroll={false}>
                      View Details <ExternalLink className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-xl text-gray-400">No work experience listed at the moment.</p>
        </div>
      )}
    </>
  );
};

/**
 * Renders the full experience list page, including header, loading spinner, and all experience cards.
 * Uses Suspense for async loading state.
 *
 * @function
 * @name ExperienceList
 * @memberof module:portfolio
 * @public
 * @web
 * @author Mike Odnis
 * @version 1.0.0
 * @see ExperienceListContent
 * @returns {JSX.Element} Top-level layout wrapped experience list page, ready for user interaction.
 * @example
 * <ExperienceList />
 */
export const ExperienceList = () => {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <Suspense
          fallback={
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-500 border-r-transparent"></div>
              <p className="text-gray-400 mt-4">Loading experiences...</p>
            </div>
          }
        >
          <ExperienceListContent />
        </Suspense>
      </div>
    </Layout>
  );
};

