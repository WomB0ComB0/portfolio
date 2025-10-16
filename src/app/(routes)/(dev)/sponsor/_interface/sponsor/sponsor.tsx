'use client';

import { Coffee, ExternalLink, Gift, Heart, Users } from 'lucide-react';
import { motion } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';
import { SiBuymeacoffee, SiGithubsponsors, SiKofi, SiOpencollective } from 'react-icons/si';
import Layout from '@/components/layout/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { type Sponsor as SponsorType, useActiveSponsors } from '@/hooks/use-github-sponsors';

/**
 * @interface SponsorPlatform
 * @description Defines the structure for a sponsorship platform.
 * @property {string} name - The display name of the sponsorship platform (e.g., 'GitHub Sponsors').
 * @property {string} username - The username or identifier on the platform.
 * @property {string} url - The URL to the sponsorship page on the platform.
 * @property {React.ReactNode} icon - The icon component associated with the platform.
 * @property {string} color - Tailwind CSS gradient color classes for styling.
 * @property {string} description - A brief description of the platform and its sponsorship method.
 * @author Mike Odnis
 * @version 1.0.0
 * @public
 */
interface SponsorPlatform {
  name: string;
  username: string;
  url: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}

/**
 * @constant
 * @readonly
 * @type {SponsorPlatform[]}
 * @description An array of objects, each representing a different platform where sponsorship is possible.
 * @see SponsorPlatform
 * @author Mike Odnis
 * @version 1.0.0
 */
const sponsorPlatforms: SponsorPlatform[] = [
  {
    name: 'GitHub Sponsors',
    username: '@WomB0ComB0',
    url: 'https://github.com/sponsors/WomB0ComB0',
    icon: <SiGithubsponsors className="h-8 w-8" />,
    color: 'from-pink-500 to-purple-600',
    description:
      'Sponsor me directly through GitHub with flexible monthly or one-time contributions.',
  },
  {
    name: 'Open Collective',
    username: '@mike-odnis',
    url: 'https://opencollective.com/mike-odnis',
    icon: <SiOpencollective className="h-8 w-8" />,
    color: 'from-blue-500 to-cyan-600',
    description: 'Support through Open Collective with transparent funding and expenses.',
  },
  {
    name: 'Ko-fi',
    username: '@Y8Y77AJEA',
    url: 'https://ko-fi.com/Y8Y77AJEA',
    icon: <SiKofi className="h-8 w-8" />,
    color: 'from-red-500 to-orange-600',
    description: 'Buy me a coffee and show your support with one-time donations.',
  },
  {
    name: 'Buy Me a Coffee',
    username: '@mikeodnis',
    url: 'https://www.buymeacoffee.com/mikeodnis',
    icon: <SiBuymeacoffee className="h-8 w-8" />,
    color: 'from-yellow-500 to-orange-500',
    description: 'Fuel my work with coffee through quick and easy one-time donations.',
  },
];

/**
 * @interface BenefitItem
 * @description Defines the structure for a sponsorship benefit item.
 * @property {React.ReactNode} icon - The icon component representing the benefit.
 * @property {string} title - The title of the benefit.
 * @property {string} description - A detailed description of the benefit.
 * @author Mike Odnis
 * @version 1.0.0
 * @public
 */
interface BenefitItem {
  icon: React.ReactNode;
  title: string;
  description: string;
}

/**
 * @constant
 * @readonly
 * @type {BenefitItem[]}
 * @description An array of benefits offered to sponsors, highlighting reasons for contribution.
 * @see BenefitItem
 * @author Mike Odnis
 * @version 1.0.0
 */
const benefits: BenefitItem[] = [
  {
    icon: <Heart className="h-6 w-6" />,
    title: 'Support Open Source',
    description: 'Help me dedicate more time to building and maintaining open-source projects.',
  },
  {
    icon: <Coffee className="h-6 w-6" />,
    title: 'Fuel Development',
    description:
      'Your support helps cover hosting costs, tools, and resources for better projects.',
  },
  {
    icon: <Gift className="h-6 w-6" />,
    title: 'Early Access',
    description: 'Get early access to new features, tools, and exclusive content.',
  },
  {
    icon: <Users className="h-6 w-6" />,
    title: 'Join the Community',
    description: 'Become part of a community of supporters and contributors.',
  },
];

/**
 * @function Sponsor
 * @description A React functional component that displays information about sponsoring the author's work.
 *   It showcases various sponsorship platforms, benefits for sponsors, and a list of current GitHub Sponsors.
 * @returns {JSX.Element} The rendered sponsorship page.
 * @author Mike Odnis
 * @version 1.0.0
 * @public
 * @web
 * @see {@link Layout} for the page layout wrapper.
 * @see {@link Card} and related components for UI elements.
 * @see {@link Button} for interactive elements.
 * @see {@link Skeleton} for loading states.
 * @see {@link useActiveSponsors} for fetching sponsor data.
 * @see {@link SponsorPlatform} for platform data structure.
 * @see {@link BenefitItem} for benefit data structure.
 * @example
 * // Render the Sponsor page
 * <Sponsor />
 */
export const Sponsor = () => {
  const { data: sponsorsData, isLoading, error } = useActiveSponsors();

  return (
    <Layout>
      <div className="w-full min-h-screen h-full p-8 flex flex-col items-center relative">
        <section className="flex flex-col w-full max-w-6xl justify-between mt-16 lg:mt-0 md:mt-0 gap-8 mb-12">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-8"
          >
            <div className="flex items-center justify-center gap-3 mb-4">
              <Heart className="h-10 w-10 text-pink-500" />
              <h1 className="text-4xl font-bold text-purple-300">Sponsor My Work</h1>
            </div>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Your sponsorship helps me continue building open-source projects, creating educational
              content, and contributing to the developer community.
            </p>
          </motion.div>

          {/* Why Sponsor Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <h2 className="text-2xl font-bold text-purple-300 mb-6 text-center">Why Sponsor Me?</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {benefits.map((benefit, index) => (
                <motion.div
                  key={benefit.title}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
                >
                  <Card className="h-full bg-[#1E1E1E] border-purple-800 hover:border-purple-600 transition-all duration-300">
                    <CardHeader>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="text-purple-400">{benefit.icon}</div>
                        <CardTitle className="text-lg text-purple-300">{benefit.title}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-400 text-sm">{benefit.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Sponsor Platforms */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <h2 className="text-2xl font-bold text-purple-300 mb-6 text-center">
              Choose Your Platform
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {sponsorPlatforms.map((platform, index) => (
                <motion.div
                  key={platform.name}
                  initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 + index * 0.1 }}
                >
                  <Card className="h-full bg-[#1E1E1E] border-purple-800 hover:border-purple-600 transition-all duration-300 group">
                    <CardHeader>
                      <div className="flex items-center justify-between mb-3">
                        <div className={`bg-gradient-to-r ${platform.color} p-3 rounded-lg`}>
                          {platform.icon}
                        </div>
                        <ExternalLink className="h-5 w-5 text-gray-400 group-hover:text-purple-400 transition-colors" />
                      </div>
                      <CardTitle className="text-xl text-purple-300">{platform.name}</CardTitle>
                      <CardDescription className="text-gray-500 text-sm">
                        {platform.username}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-gray-400 text-sm">{platform.description}</p>
                      <Button
                        asChild
                        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                      >
                        <Link
                          href={platform.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2"
                        >
                          <span>Sponsor on {platform.name}</span>
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Current Sponsors Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
          >
            <Card className="bg-gradient-to-br from-purple-900/20 to-indigo-900/20 border-purple-800">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 mb-2">
                    <Users className="h-6 w-6 text-purple-400" />
                    <CardTitle className="text-2xl text-purple-300">Current Sponsors</CardTitle>
                  </div>
                  {sponsorsData && sponsorsData.totalCount > 0 && (
                    <div className="text-purple-400 font-semibold">
                      {sponsorsData.totalCount}{' '}
                      {sponsorsData.totalCount === 1 ? 'Sponsor' : 'Sponsors'}
                    </div>
                  )}
                </div>
                <CardDescription className="text-gray-400">
                  Thank you to these amazing people who support my work!
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex flex-wrap justify-center gap-4 py-8">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-20 w-full max-w-xs" />
                    ))}
                  </div>
                ) : error ? (
                  <div className="text-center py-8">
                    <p className="text-red-400 mb-2">Unable to load sponsors</p>
                    <p className="text-gray-500 text-sm">{error.message}</p>
                  </div>
                ) : !sponsorsData || sponsorsData.totalCount === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-400 mb-4">
                      Be the first to sponsor and see your name here!
                    </p>
                    <div className="flex flex-wrap justify-center gap-4">
                      <div className="flex items-center gap-2 px-4 py-2 bg-[#1E1E1E] border border-purple-800 rounded-lg">
                        <Heart className="h-4 w-4 text-pink-500" />
                        <span className="text-gray-400 text-sm">Awaiting our first sponsor...</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Sponsor Statistics */}
                    {sponsorsData.totalMonthlyIncome > 0 && (
                      <div className="flex items-center justify-center gap-8 p-4 bg-[#1E1E1E] border border-purple-800 rounded-lg">
                        <div className="text-center">
                          <p className="text-sm text-gray-400 mb-1">Monthly Support</p>
                          <p className="text-2xl font-bold text-purple-300">
                            ${sponsorsData.totalMonthlyIncome}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Sponsors Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {sponsorsData.sponsors.map((sponsor: SponsorType) => (
                        <motion.div
                          key={sponsor.login}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3 }}
                        >
                          <Link
                            href={sponsor.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                          >
                            <Card className="h-full bg-[#1E1E1E] border-purple-800 hover:border-purple-600 transition-all duration-300 group">
                              <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                  <div className="relative h-12 w-12 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-purple-800 group-hover:ring-purple-600 transition-all">
                                    <Image
                                      src={sponsor.avatarUrl}
                                      alt={sponsor.name || sponsor.login}
                                      fill
                                      className="object-cover"
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-purple-300 truncate group-hover:text-purple-200 transition-colors">
                                      {sponsor.name || sponsor.login}
                                    </p>
                                    <p className="text-sm text-gray-500 truncate">
                                      @{sponsor.login}
                                    </p>
                                    {sponsor.tier && (
                                      <div className="flex items-center gap-2 mt-1">
                                        <Heart className="h-3 w-3 text-pink-500" />
                                        <span className="text-xs text-pink-400">
                                          ${sponsor.tier.monthlyPriceInDollars}/month
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  <ExternalLink className="h-4 w-4 text-gray-500 group-hover:text-purple-400 transition-colors flex-shrink-0" />
                                </div>
                              </CardContent>
                            </Card>
                          </Link>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Additional Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="text-center mt-8"
          >
            <Card className="bg-[#1E1E1E] border-purple-800">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-purple-300 mb-3">
                  Questions About Sponsorship?
                </h3>
                <p className="text-gray-400 mb-4">
                  Feel free to reach out if you have any questions about sponsoring or want to
                  discuss custom sponsorship opportunities.
                </p>
                <Button
                  asChild
                  variant="outline"
                  className="border-purple-700 text-purple-400 hover:bg-purple-900/20"
                >
                  <Link href="/contact">Contact Me</Link>
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </section>
      </div>
    </Layout>
  );
};

Sponsor.displayName = 'Sponsor';
export default Sponsor;
