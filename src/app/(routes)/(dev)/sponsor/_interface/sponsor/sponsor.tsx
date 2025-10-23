/**
 * Copyright 2025 Mike Odnis
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use client';

import { Coffee, ExternalLink, Gift, Heart, Users } from 'lucide-react';
import { motion } from 'motion/react';
import Image from 'next/image';
import { SiBuymeacoffee, SiGithubsponsors, SiKofi, SiOpencollective } from 'react-icons/si';
import Layout from '@/components/layout/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { type Sponsor as SponsorType, useActiveSponsors } from '@/hooks/use-github-sponsors';
import { obfuscateLink } from '@/utils';

interface SponsorPlatform {
  name: string;
  username: string;
  url: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}

const sponsorPlatforms = [
  {
    name: 'GitHub Sponsors',
    username: '@WomB0ComB0',
    url: 'https://github.com/sponsors/WomB0ComB0',
    icon: <SiGithubsponsors className="h-6 w-6" />,
    color: 'from-gh-sponsors-start to-gh-sponsors-end',
    description:
      'Sponsor me directly through GitHub with flexible monthly or one-time contributions.',
  },
  {
    name: 'Open Collective',
    username: '@mike-odnis',
    url: 'https://opencollective.com/mike-odnis',
    icon: <SiOpencollective className="h-6 w-6" />,
    color: 'from-oc-start to-oc-end',
    description: 'Support through Open Collective with transparent funding and expenses.',
  },
  {
    name: 'Ko-fi',
    username: '@Y8Y77AJEA',
    url: 'https://ko-fi.com/Y8Y77AJEA',
    icon: <SiKofi className="h-6 w-6" />,
    color: 'from-kofi-start to-kofi-end',
    description: 'Buy me a coffee and show your support with one-time donations.',
  },
  {
    name: 'Buy Me a Coffee',
    username: '@mikeodnis',
    url: 'https://www.buymeacoffee.com/mikeodnis',
    icon: <SiBuymeacoffee className="h-6 w-6" />,
    color: 'from-bmc-start to-bmc-end',
    description: 'Fuel my work with coffee through quick and easy one-time donations.',
  },
] as const satisfies readonly SponsorPlatform[];

interface BenefitItem {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const benefits = [
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
] as const satisfies readonly BenefitItem[];

export const Sponsor = () => {
  const { data: sponsorsData, isLoading, error } = useActiveSponsors();

  return (
    <Layout>
      <div className="relative flex min-h-screen w-full flex-col items-center px-4 py-8 sm:px-6 lg:px-12">
        <section className="w-full max-w-screen-xl">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-8"
          >
            <div className="mb-4 flex items-center justify-center gap-3">
              <Heart className="h-10 w-10 text-accent" />
              <h1 className="text-3xl font-bold text-primary sm:text-4xl">Sponsor My Work</h1>
            </div>
            <p className="mx-auto max-w-2xl text-base text-muted-foreground sm:text-lg">
              Your sponsorship helps me continue building open-source projects, creating educational
              content, and contributing to the developer community.
            </p>
          </motion.div>

          {/* Why Sponsor Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-8"
          >
            <h2 className="mb-6 text-center text-xl font-bold text-primary sm:text-2xl">
              Why Sponsor Me?
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {benefits.map((benefit, index) => (
                <motion.div
                  key={benefit.title}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.45, delay: 0.1 + index * 0.05 }}
                >
                  <Card className="h-full w-full border-border bg-card transition-all duration-300 hover:border-primary">
                    <CardHeader>
                      <div className="mb-2 flex items-center gap-3 min-w-0">
                        <div className="text-primary flex-shrink-0">{benefit.icon}</div>
                        <CardTitle className="text-base text-primary sm:text-lg truncate">
                          {benefit.title}
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground break-words">
                        {benefit.description}
                      </p>
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
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-8"
          >
            <h2 className="mb-6 text-center text-xl font-bold text-primary sm:text-2xl">
              Choose Your Platform
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {sponsorPlatforms.map((platform, index) => (
                <motion.div
                  key={platform.name}
                  initial={{ opacity: 0, x: index % 2 === 0 ? -10 : 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 + index * 0.05 }}
                >
                  <Card className="group h-full w-full border-border bg-card transition-all duration-300 hover:border-primary">
                    <CardHeader>
                      <div className="mb-3 flex items-center justify-between">
                        <div
                          className={`${platform.color} flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg p-2`}
                          aria-hidden
                        >
                          {platform.icon}
                        </div>
                        <ExternalLink className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
                      </div>
                      <CardTitle className="text-lg text-primary">{platform.name}</CardTitle>
                      <CardDescription className="text-sm text-muted-foreground truncate">
                        {platform.username}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">{platform.description}</p>
                      <Button asChild className="w-full text-primary-foreground">
                        <a
                          href={platform.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex w-full items-center gap-2 flex-row justify-between"
                        >
                          <span className="truncate text-background">
                            Sponsor on {platform.name}
                          </span>
                          <ExternalLink className="h-4 w-4" />
                        </a>
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
            transition={{ duration: 0.5, delay: 0.35 }}
            className="mb-8"
          >
            <Card className="border-border bg-gradient-to-br from-primary/10 to-secondary/10">
              <CardHeader>
                <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
                  <div className="flex items-center gap-3">
                    <Users className="h-6 w-6 text-primary" />
                    <CardTitle className="text-lg text-primary sm:text-2xl">
                      Current Sponsors
                    </CardTitle>
                  </div>
                  {sponsorsData && sponsorsData.totalCount > 0 && (
                    <div className="font-semibold text-primary">
                      {sponsorsData.totalCount}{' '}
                      {sponsorsData.totalCount === 1 ? 'Sponsor' : 'Sponsors'}
                    </div>
                  )}
                </div>
                <CardDescription className="text-muted-foreground">
                  Thank you to these amazing people who support my work!
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="grid grid-cols-1 gap-4 py-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    {[...Array(4)].map((_, i) => (
                      <Card
                        key={`sponsor-card-skeleton-${+i}`}
                        className="h-full w-full border-border bg-card"
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <Skeleton className="h-12 w-12 rounded-full" />
                            <div className="min-w-0 flex-1 space-y-2">
                              <Skeleton className="h-4 w-3/4" />
                              <Skeleton className="h-3 w-1/2" />
                              <Skeleton className="h-3 w-1/3" />
                            </div>
                            <Skeleton className="h-4 w-4" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : error ? (
                  <div className="py-8 text-center">
                    <p className="mb-2 text-destructive">Unable to load sponsors</p>
                    <p className="text-sm text-muted-foreground">{error.message}</p>
                  </div>
                ) : !sponsorsData || sponsorsData.totalCount === 0 ? (
                  <div className="py-8 text-center">
                    <p className="mb-4 text-muted-foreground">
                      Be the first to sponsor and see your name here!
                    </p>
                    <div className="flex flex-wrap justify-center gap-4">
                      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2">
                        <Heart className="h-4 w-4 text-accent" />
                        <span className="text-sm text-muted-foreground">
                          Awaiting our first sponsor...
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Sponsor Statistics */}
                    {sponsorsData.totalMonthlyIncome > 0 && (
                      <div className="flex items-center justify-center gap-8 rounded-lg border border-border bg-card p-4">
                        <div className="text-center">
                          <p className="mb-1 text-sm text-muted-foreground">Monthly Support</p>
                          <p className="text-2xl font-bold text-primary">
                            ${sponsorsData.totalMonthlyIncome}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Sponsors Grid */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                      {sponsorsData.sponsors.map((sponsor: SponsorType) => (
                        <motion.div
                          key={sponsor.login}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3 }}
                        >
                          <a
                            href={sponsor.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                          >
                            <Card className="group h-full w-full border-border bg-card transition-all duration-300 hover:border-primary">
                              <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                  <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full ring-2 ring-border transition-all group-hover:ring-primary">
                                    <Image
                                      src={sponsor.avatarUrl}
                                      alt={`${sponsor.name || sponsor.login}'s avatar`}
                                      fill
                                      className="object-cover"
                                      sizes="48px"
                                      placeholder="empty"
                                    />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate font-semibold text-primary transition-colors group-hover:text-primary-foreground">
                                      {sponsor.name || sponsor.login}
                                    </p>
                                    <p className="truncate text-sm text-muted-foreground">
                                      @{sponsor.login}
                                    </p>
                                    {sponsor.tier && (
                                      <div className="mt-1 flex items-center gap-2">
                                        <Heart className="h-3 w-3 text-accent" />
                                        <span className="text-xs text-accent">
                                          ${sponsor.tier.monthlyPriceInDollars}
                                          /month
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  <ExternalLink className="h-4 w-4 flex-shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                                </div>
                              </CardContent>
                            </Card>
                          </a>
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
            transition={{ duration: 0.5, delay: 0.45 }}
            className="mt-4 text-center"
          >
            <Card className="border-border bg-card">
              <CardContent className="p-6">
                <h3 className="mb-3 text-base font-semibold text-primary sm:text-lg">
                  Questions About Sponsorship?
                </h3>
                <p className="mb-4 text-sm text-muted-foreground">
                  Feel free to reach out if you have any questions about sponsoring or want to
                  discuss custom sponsorship opportunities.
                </p>
                <Button
                  asChild
                  variant="outline"
                  className="mx-auto block border-primary text-primary hover:bg-primary/10"
                >
                  <a
                    href={
                      obfuscateLink({
                        scheme: 'mailto',
                        address: 'mike@mikeodnis.dev',
                      }).encodedHref
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2"
                  >
                    Contact Me
                  </a>
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
