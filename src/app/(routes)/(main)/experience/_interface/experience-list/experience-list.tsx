'use client';

import { Briefcase, ExternalLink } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import Layout from '@/components/layout/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { experienceData } from '@/data/home-sections';

export const ExperienceList = () => {
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
                    <div className="flex-shrink-0 w-16 h-16 relative">
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
                  <Button
                    asChild
                    variant="outline"
                    className="w-full bg-purple-800 hover:bg-purple-700 border-purple-700 text-purple-200"
                  >
                    <Link href={`/experience/${item.id}`} scroll={false}>
                      View Details <ExternalLink className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
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
};
