
'use client';

import Layout from '@/components/layout/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSanityCertifications } from '@/hooks';
import { urlFor } from '@/lib/sanity/client';
import type { Certification } from '@/lib/sanity/types';
import { Award } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense, useMemo } from 'react';

/**
 * @function CertificationsContent
 * @description
 *   Displays a grouped list of professional certifications retrieved from Sanity.
 *   Groups certifications by issuer and displays category sections with cards per certification.
 *   Includes formatting for dates, credential IDs, links, logos, skills, and empty states.
 * @returns {JSX.Element} A fragment containing grouped certification sections and UI states.
 * @throws {Error} Throws if `useSanityCertifications` fails or certifications data is in an unexpected shape.
 * @web
 * @public
 * @author Mike Odnis <https://github.com/WomB0ComB0>
 * @see https://github.com/WomB0ComB0/portfolio
 * @version 1.0.0
 * @example
 * // Usage in parent component:
 * <CertificationsContent />
 */
const CertificationsContent = () => {
  const { data: certifications } = useSanityCertifications();
  const certificationsList = certifications as any[];

  /**
   * @function formatDate
   * @description
   *   Formats an ISO date string as a human-readable date in 'en-US' locale.
   * @param {string} dateString - The ISO date string to format.
   * @returns {string} The formatted date string.
   * @private
   */
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  /**
   * @readonly
   * @description
   *   Groups certifications by issuer/category using useMemo for optimized re-renders.
   * @type {Record<string, Certification[]>}
   */
  const groupedCertifications = useMemo(() => {
    if (!certificationsList) return {};
    return certificationsList.reduce(
      (acc, cert) => {
        const category = cert.issuer || 'General';
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(cert);
        return acc;
      },
      {} as Record<string, Certification[]>,
    );
  }, [certificationsList]);

  return (
    <>
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-bold text-purple-300 flex items-center justify-center">
          <Award className="mr-3 h-10 w-10" /> My Certifications
        </h1>
        <p className="text-lg text-gray-400 mt-2">
          A collection of my professional certifications and credentials.
        </p>
      </header>

      {Object.entries(groupedCertifications).map(([issuer, certs]) => (
        <section key={issuer} className="mb-12">
          <h2 className="text-2xl font-semibold text-purple-400 mb-6 border-b-2 border-purple-700 pb-2">
            {issuer}
          </h2>
          {(certs as any[]).length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {(certs as any[]).map((cert: any) => (
                <Card
                  key={cert._id}
                  className="bg-[#1E1E1E] border-purple-800 rounded-xl overflow-hidden flex flex-col hover:shadow-xl hover:shadow-purple-500/40 transition-shadow duration-300"
                >
                  {cert.logo && (
                    <div className="w-full h-48 relative bg-gray-800">
                      <Image
                        src={urlFor(cert.logo).width(384).height(192).url()}
                        alt={`${cert.name} logo`}
                        width={384}
                        height={192}
                        className="object-contain p-4"
                      />
                    </div>
                  )}
                  <CardHeader className="p-6">
                    <CardTitle className="text-xl font-semibold text-purple-300 mb-1">
                      {cert.name}
                    </CardTitle>
                    <p className="text-sm text-gray-400">{cert.issuer}</p>
                  </CardHeader>
                  <CardContent className="p-6 flex-grow">
                    <p className="text-sm text-gray-400 mb-1">
                      <strong>Issued:</strong> {formatDate(cert.issueDate)}
                    </p>
                    {cert.expiryDate && (
                      <p className="text-sm text-gray-400 mb-2">
                        <strong>Expires:</strong> {formatDate(cert.expiryDate)}
                      </p>
                    )}
                    {cert.credentialId && (
                      <p className="text-xs text-gray-500 mb-2">
                        <strong>ID:</strong> {cert.credentialId}
                      </p>
                    )}
                    {cert.description && (
                      <p className="text-sm text-gray-300 mt-3">{cert.description}</p>
                    )}
                    {cert.skills && cert.skills.length > 0 && (
                      <div className="mt-3">
                        <h4 className="text-xs text-purple-400 mb-1 font-semibold">SKILLS:</h4>
                        <div className="flex flex-wrap gap-1">
                          {cert.skills.map((skill: string) => (
                            <span
                              key={skill}
                              className="px-2 py-0.5 text-xs bg-purple-700 text-purple-200 rounded-full"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {cert.credentialUrl && (
                      <Link
                        href={cert.credentialUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-purple-400 hover:text-purple-300 underline mt-3 inline-block"
                      >
                        View Certificate →
                      </Link>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-gray-400">No certifications listed from this issuer yet.</p>
          )}
        </section>
      ))}
      {Object.keys(groupedCertifications).length === 0 && (
        <div className="text-center py-12">
          <p className="text-xl text-gray-400">No certifications available at the moment.</p>
        </div>
      )}
    </>
  );
};

/**
 * @function Certifications
 * @description
 *   Renders the entire certifications page wrapped within the application's main layout.
 *   Uses Suspense to handle async loading of certification content and displays a loading fallback.
 * @returns {JSX.Element} The JSX for the certifications page with loading support.
 * @web
 * @public
 * @author Mike Odnis <https://github.com/WomB0ComB0>
 * @version 1.0.0
 * @see CertificationsContent
 * @example
 * // Usage:
 * <Certifications />
 */
export const Certifications = () => {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <Suspense
          fallback={
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-500 border-r-transparent"></div>
              <p className="text-gray-400 mt-4">Loading certifications...</p>
            </div>
          }
        >
          <CertificationsContent />
        </Suspense>
      </div>
    </Layout>
  );
};

