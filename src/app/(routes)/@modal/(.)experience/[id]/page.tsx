import { ExternalLink } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Modal from '@/components/ui/modal';
import { experienceData } from '../../../../../data/homeSections';

export default async function ExperienceModal({ params }: { params: { id: string } }) {
  const { id } = await params;
  const experience = experienceData.find((e) => e.id === id);

  if (!experience) {
    notFound();
  }

  return (
    <Modal>
      <Card className="bg-transparent border-0">
        <CardHeader className="flex flex-row items-start gap-4 p-0">
          {experience.companyImage && (
            <div className="flex-shrink-0 w-24 h-24 relative">
              <Image
                src={experience.companyImage}
                alt={`${experience.companyTitle} logo`}
                fill
                sizes="96px"
                className="rounded-md object-contain bg-white p-1"
              />
            </div>
          )}
          <div className="flex-grow">
            <CardTitle className="text-3xl font-semibold text-purple-300 mb-1">
              {experience.jobTitle}
            </CardTitle>
            <p className="text-xl text-gray-400">{experience.companyTitle}</p>
            <p className="text-md text-gray-500">{experience.employmentPeriod}</p>
          </div>
        </CardHeader>
        <CardContent className="p-0 pt-6">
          <h4 className="text-lg text-purple-400 mb-2 font-semibold">Job Description:</h4>
          <p className="text-base text-gray-300 mb-6 whitespace-pre-line">
            {experience.jobDescriptionLong}
          </p>

          {experience.skills && experience.skills.length > 0 && (
            <div className="mb-6">
              <h4 className="text-lg text-purple-400 mb-2 font-semibold">Skills:</h4>
              <div className="flex flex-wrap gap-2">
                {experience.skills.map((skill) => (
                  <span
                    key={skill}
                    className="px-3 py-1 text-sm bg-purple-700 text-purple-200 rounded-full"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {experience.media && experience.media.length > 0 && (
            <div>
              <h4 className="text-lg text-purple-400 mb-2 font-semibold">Related Media:</h4>
              <div className="flex flex-col gap-4">
                {experience.media.map((mediaItem, index) => (
                  <div key={index}>
                    {mediaItem.type === 'link' && (
                      <Link href={mediaItem.url} target="_blank" rel="noopener noreferrer">
                        <Button
                          variant="outline"
                          size="sm"
                          className="bg-gray-700 hover:bg-gray-600 border-gray-600 text-gray-200"
                        >
                          {mediaItem.title} <ExternalLink className="ml-2 h-4 w-4" />
                        </Button>
                      </Link>
                    )}
                    {mediaItem.type === 'image' && (
                      <div className="w-full h-64 relative">
                        <Image
                          src={mediaItem.url}
                          alt={mediaItem.title}
                          layout="fill"
                          className="object-contain"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </Modal>
  );
}
