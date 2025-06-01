'use client'; // Keep as client component for consistency, can be server if no client hooks needed

import { ExperienceItem } from '../../../types/sections';
import { experienceData } from '../../../data/homeSections';
import Layout from '@/components/layout/Layout'; // Adjusted path
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import Link from 'next/link';
import { ExternalLink, Briefcase } from 'lucide-react'; // Using Briefcase from lucide-react for page title

export default function ExperiencePage() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-purple-300 flex items-center justify-center">
            <Briefcase className="mr-3 h-10 w-10" /> My Work Experience
          </h1>
          <p className="text-lg text-gray-400 mt-2">
            A summary of my professional roles and contributions.
          </p>
        </header>

        {experienceData.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {experienceData.map((item) => (
              <Card
                key={item.id}
                className="bg-[#1E1E1E] border-purple-800 rounded-xl overflow-hidden flex flex-col hover:shadow-xl hover:shadow-purple-500/40 transition-shadow duration-300"
              >
                <CardHeader className="flex flex-row items-start gap-4 p-6">
                  {item.companyImage && (
                    <div className="flex-shrink-0 w-16 h-16 relative"> {/* Adjusted size for consistency */}
                      <Image
                        src={item.companyImage}
                        alt={`${item.companyTitle} logo`}
                        layout="fill"
                        className="rounded-md object-contain bg-white p-1"
                      />
                    </div>
                  )}
                  <div className="flex-grow">
                    <CardTitle className="text-xl font-semibold text-purple-300 mb-1">
                      {item.jobTitle}
                    </CardTitle>
                    <p className="text-md text-gray-400">{item.companyTitle}</p>
                    <p className="text-xs text-gray-500">{item.employmentPeriod}</p>
                  </div>
                </CardHeader>
                <CardContent className="p-6 flex-grow">
                  <p className="text-sm text-gray-300 mb-4 line-clamp-3">
                    {item.jobDescriptionShort}
                  </p>
                </CardContent>
                <div className="p-6 border-t border-purple-700 mt-auto">
                  <Link href={`/experience/${item.id}`} passHref legacyBehavior>
                    <Button
                      variant="outline"
                      className="w-full bg-purple-800 hover:bg-purple-700 border-purple-700 text-purple-200"
                    >
                      View Details <ExternalLink className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-xl text-gray-400">No work experience listed at the moment.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
