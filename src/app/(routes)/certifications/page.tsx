'use client'; // Keep as client component if any interactivity is planned, or convert if not.

import { Award } from 'lucide-react'; // Using Award from lucide-react
import Image from 'next/image';
import Layout from '@/components/layout/Layout'; // Adjusted path
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { certificationsData } from '../../../data/homeSections';
import type { CertificationItem } from '../../../types/sections';

export default function CertificationsPage() {
  // Helper to format dates (can be moved to a utils file if used elsewhere)
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Group certifications by category
  const groupedCertifications = certificationsData.reduce(
    (acc, cert) => {
      const category = cert.category || 'General'; // Default category if none provided
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(cert);
      return acc;
    },
    {} as Record<string, CertificationItem[]>,
  );

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-purple-300 flex items-center justify-center">
            <Award className="mr-3 h-10 w-10" /> My Certifications
          </h1>
          <p className="text-lg text-gray-400 mt-2">
            A collection of my professional certifications and credentials.
          </p>
        </header>

        {Object.entries(groupedCertifications).map(([category, certs]) => (
          <section key={category} className="mb-12">
            <h2 className="text-2xl font-semibold text-purple-400 mb-6 border-b-2 border-purple-700 pb-2">
              {category}
            </h2>
            {certs.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {certs.map((cert) => (
                  <Card
                    key={cert.id}
                    className="bg-[#1E1E1E] border-purple-800 rounded-xl overflow-hidden flex flex-col hover:shadow-xl hover:shadow-purple-500/40 transition-shadow duration-300"
                  >
                    {cert.imageUrl && (
                      <div className="w-full h-48 relative bg-gray-800">
                        {' '}
                        {/* Added bg for better image presentation */}
                        <Image
                          src={cert.imageUrl}
                          alt={`${cert.title} logo`}
                          layout="fill"
                          className="object-contain p-4" // Changed to contain and added padding
                        />
                      </div>
                    )}
                    <CardHeader className="p-6">
                      <CardTitle className="text-xl font-semibold text-purple-300 mb-1">
                        {cert.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 flex-grow">
                      <p className="text-sm text-gray-400 mb-1">
                        <strong>Acquired:</strong> {formatDate(cert.acquisitionDate)}
                      </p>
                      {cert.expirationDate && (
                        <p className="text-sm text-gray-400">
                          <strong>Expires:</strong> {formatDate(cert.expirationDate)}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-gray-400">No certifications listed in this category yet.</p>
            )}
          </section>
        ))}
        {Object.keys(groupedCertifications).length === 0 && (
          <div className="text-center py-12">
            <p className="text-xl text-gray-400">No certifications available at the moment.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
