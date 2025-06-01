import { experienceData } from '../../../data/homeSections';
import { ExperienceItem } from '../../../types/sections';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Paperclip } from 'lucide-react'; // Added Paperclip for media links

export async function generateStaticParams() {
  return experienceData.map((exp) => ({
    id: exp.id,
  }));
}

interface ExperienceDetailPageProps {
  params: { id: string };
}

export default function ExperienceDetailPage({ params }: ExperienceDetailPageProps) {
  const experienceItem = experienceData.find((exp) => exp.id === params.id);

  if (!experienceItem) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12 text-center">
          <h1 className="text-3xl font-bold text-purple-300 mb-4">Experience Not Found</h1>
          <p className="text-gray-400 mb-8">
            The experience item you are looking for does not exist.
          </p>
          <Link href="/" passHref legacyBehavior>
            <Button variant="outline" className="text-purple-300 border-purple-700 hover:bg-purple-800">
              <ArrowLeft className="mr-2 h-5 w-5" /> Back to Home
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const {
    companyTitle,
    companyImage,
    employmentPeriod,
    jobTitle,
    jobDescriptionLong,
    skills,
    media,
  } = experienceItem;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <section className="w-full max-w-3xl mx-auto bg-[#1E1E1E] border border-purple-800 rounded-xl overflow-hidden">
          <article className="p-6 md:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row items-start gap-6 mb-6">
              {companyImage && (
                <div className="flex-shrink-0 w-24 h-24 relative">
                  <Image
                    src={companyImage}
                    alt={`${companyTitle} logo`}
                    layout="fill"
                    className="rounded-lg object-contain bg-white p-1"
                  />
                </div>
              )}
              <div className="flex-grow">
                <h1 className="text-3xl font-bold text-purple-300 mb-1">{jobTitle}</h1>
                <h2 className="text-xl font-semibold text-purple-400 mb-1">{companyTitle}</h2>
                <p className="text-sm text-gray-500">{employmentPeriod}</p>
              </div>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-purple-300 mb-2">Job Description</h3>
              <p className="text-gray-300 whitespace-pre-line">{jobDescriptionLong}</p>
            </div>

            {skills && skills.length > 0 && (
              <div>
                <h3 className="text-xl font-semibold text-purple-300 mb-2">Skills Utilized</h3>
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 text-sm bg-purple-700 text-purple-200 rounded-full"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {media && media.length > 0 && (
              <div>
                <h3 className="text-xl font-semibold text-purple-300 mb-3">Related Media</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {media.map((mediaItem, index) => (
                    <div key={index} className="bg-[#2a2a2a] p-3 rounded-lg border border-purple-700">
                      {mediaItem.type === 'image' && mediaItem.url && (
                        <>
                          {mediaItem.title && <p className="text-sm font-medium text-purple-300 mb-2">{mediaItem.title}</p>}
                          <div className="relative w-full h-40 rounded overflow-hidden">
                            <Image
                              src={mediaItem.url}
                              alt={mediaItem.title || 'Experience Media Image'}
                              layout="fill"
                              className="object-cover"
                            />
                          </div>
                        </>
                      )}
                      {mediaItem.type === 'link' && mediaItem.url && (
                        <a
                          href={mediaItem.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center text-purple-400 hover:text-purple-300 transition-colors"
                        >
                          <Paperclip className="mr-2 h-5 w-5 flex-shrink-0" />
                          <span className="truncate">
                            {mediaItem.title || mediaItem.url}
                          </span>
                          <ExternalLink className="ml-auto h-4 w-4 flex-shrink-0" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-8 pt-6 border-t border-purple-700">
              <Link href="/" passHref legacyBehavior>
                <Button variant="outline" className="text-purple-300 border-purple-700 hover:bg-purple-800">
                  <ArrowLeft className="mr-2 h-5 w-5" /> Back to Home
                </Button>
              </Link>
            </div>
          </article>
        </section>
      </div>
    </Layout>
  );
}
