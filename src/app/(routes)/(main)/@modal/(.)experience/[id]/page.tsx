
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Modal from '@/components/ui/modal';
import { getExperiences } from '@/lib/sanity/api';
import { urlFor } from '@/lib/sanity/client';
import { logger } from '@/utils';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { JSX } from 'react';

/**
 * @function ExperienceModal
 * @description
 *      Renders a modal overlay displaying detailed information about a specific work experience.
 *      Fetches data from the backend according to the provided experience ID, displaying metadata,
 *      company logo, position, duration, technologies, responsibilities, and a company website link if available.
 *      Shows a 404 page/modal when the experience is not found.
 *
 * @async
 * @param {{ params: Promise<{ id: string }> }} arg
 *      An object containing a promise that resolves to route parameters,
 *      specifically the 'id' of the experience to look up.
 *
 * @returns {Promise<JSX.Element>}
 *      A modal React element containing the experience details card, or triggers a 404 if not found.
 *
 * @throws {Error}
 *      Throws if fetching experiences fails. Triggers notFound() if the specified experience does not exist.
 *
 * @web
 * @public
 * @author Mike Odnis <https://github.com/WomB0ComB0>
 * @version 1.0.0
 * @see https://github.com/WomB0ComB0/portfolio
 * @example
 * // Usage as a route modal in Next.js:
 * export default async function Page(params) {
 *   return <ExperienceModal params={params} />;
 * }
 */
export default async function ExperienceModal({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<JSX.Element> {
  const { id } = await params;

  let experience;
  try {
    const experiences = await getExperiences();
    experience = experiences.find((e) => e._id === id);
  } catch (error) {
    logger.error('Error fetching experience:', error);
  }

  if (!experience) {
    notFound();
  }

  const period = experience.current
    ? `${new Date(experience.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - Present`
    : `${new Date(experience.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - ${experience.endDate ? new Date(experience.endDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Present'}`;

  return (
    <Modal>
      <Card className="bg-transparent border-0">
        <CardHeader className="flex flex-row items-start gap-4 p-0">
          {experience.logo && (
            <div className="flex-shrink-0 w-24 h-24 relative">
              <Image
                src={urlFor(experience.logo).width(96).height(96).url()}
                alt={`${experience.company} logo`}
                width={96}
                height={96}
                className="rounded-md object-contain bg-white p-1"
              />
            </div>
          )}
          <div className="flex-grow">
            <CardTitle className="text-3xl font-semibold text-purple-300 mb-1">
              {experience.position}
            </CardTitle>
            <p className="text-xl text-gray-400">{experience.company}</p>
            <p className="text-md text-gray-500">{period}</p>
            {experience.location && <p className="text-sm text-gray-500">{experience.location}</p>}
          </div>
        </CardHeader>
        <CardContent className="p-0 pt-6">
          <h4 className="text-lg text-purple-400 mb-2 font-semibold">Description:</h4>
          <p className="text-base text-gray-300 mb-6 whitespace-pre-line">
            {experience.description}
          </p>

          {experience.responsibilities && experience.responsibilities.length > 0 && (
            <div className="mb-6">
              <h4 className="text-lg text-purple-400 mb-2 font-semibold">Key Responsibilities:</h4>
              <ul className="list-disc list-inside space-y-1 text-gray-300">
                {experience.responsibilities.map((responsibility, index) => (
                  <li key={index}>{responsibility}</li>
                ))}
              </ul>
            </div>
          )}

          {experience.technologies && experience.technologies.length > 0 && (
            <div className="mb-6">
              <h4 className="text-lg text-purple-400 mb-2 font-semibold">Technologies:</h4>
              <div className="flex flex-wrap gap-2">
                {experience.technologies.map((tech) => (
                  <span
                    key={tech}
                    className="px-3 py-1 text-sm bg-purple-700 text-purple-200 rounded-full"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          )}

          {experience.companyUrl && (
            <div>
              <Link
                href={experience.companyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 underline"
              >
                Visit Company Website →
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </Modal>
  );
}

