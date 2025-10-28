'use client';


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

import { MagicCard, PageHeader } from '@/components';
import Layout from '@/components/layout/layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { emailHref } from '@/constants';
import { useGitHubSponsors } from '@/hooks/use-github-sponsors';
import type { Sponsor as SponsorType } from '@/hooks/use-github-sponsors.types';
import { Coffee, ExternalLink, Gift, Heart, Users, Mail, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import Image from 'next/image';
import { useMemo } from 'react';
import { SiBuymeacoffee, SiGithubsponsors, SiKofi, SiOpencollective } from 'react-icons/si';

const sponsorPlatforms = [
  {
    name: 'GitHub Sponsors',
    username: '@WomB0ComB0',
    url: 'https://github.com/sponsors/WomB0ComB0',
    icon: SiGithubsponsors,
    color: 'from-purple-500 to-pink-500',
    description: 'Flexible monthly or one-time contributions directly through GitHub.',
  },
  {
    name: 'Open Collective',
    username: '@mike-odnis',
    url: 'https://opencollective.com/mike-odnis',
    icon: SiOpencollective,
    color: 'from-blue-500 to-blue-700',
    description: 'Transparent funding with public expense tracking.',
  },
  {
    name: 'Ko-fi',
    username: '@Y8Y77AJEA',
    url: 'https://ko-fi.com/Y8Y77AJEA',
    icon: SiKofi,
    color: 'from-amber-500 to-amber-700',
    description: 'Quick one-time donations to fuel my work.',
  },
  {
    name: 'Buy Me a Coffee',
    username: '@mikeodnis',
    url: 'https://www.buymeacoffee.com/mikeodnis',
    icon: SiBuymeacoffee,
    color: 'from-yellow-500 to-yellow-700',
    description: 'Easy coffee-sized donations to show support.',
  },
] as const;

const benefits = [
  {
    icon: Heart,
    title: 'Support Open Source',
    description: 'Help me dedicate more time to building and maintaining open-source projects.',
  },
  {
    icon: Coffee,
    title: 'Fuel Development',
    description: 'Cover hosting costs, tools, and resources for better projects.',
  },
  {
    icon: Gift,
    title: 'Early Access',
    description: 'Get early access to new features, tools, and exclusive content.',
  },
  {
    icon: Users,
    title: 'Join the Community',
    description: 'Become part of a community of supporters and contributors.',
  },
] as const;

export const Sponsor = () => {
  const { data: sponsorsData, isLoading, error } = useGitHubSponsors();

  const currentSponsors = useMemo(
    () => sponsorsData?.sponsors.filter((s) => s.isActive) ?? [],
    [sponsorsData],
  );

  const pastSponsors = useMemo(
    () => sponsorsData?.sponsors.filter((s) => !s.isActive) ?? [],
    [sponsorsData],
  );

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring' as const,
        stiffness: 100,
        damping: 15,
      },
    },
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 md:px-6 py-12 max-w-6xl">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-12"
        >
          {/* Hero Section */}
          <motion.div variants={itemVariants}>
            <PageHeader
              title="Sponsor My Work"
              description="Your support helps me build open-source projects, create educational content, and contribute to the developer community."
              icon={<Heart />}
            />
          </motion.div>

          {/* Benefits Section */}
          <motion.section variants={itemVariants}>
            <h2 className="text-2xl font-semibold text-foreground mb-6">Why Sponsor?</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {benefits.map((benefit) => (
                <motion.div
                  key={benefit.title}
                  whileHover={{ y: -4 }}
                  transition={{ type: 'spring' as const, stiffness: 300, damping: 20 }}
                >
                  <MagicCard className="border-border h-full hover:border-primary/50 transition-all duration-300">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <benefit.icon className="h-5 w-5 text-primary" />
                        </div>
                        <CardTitle className="text-base">{benefit.title}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {benefit.description}
                      </p>
                    </CardContent>
                  </MagicCard>
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* Sponsor Platforms */}
          <motion.section variants={itemVariants}>
            <h2 className="text-2xl font-semibold text-foreground mb-6">Choose Your Platform</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {sponsorPlatforms.map((platform) => {
                const Icon = platform.icon;
                return (
                  <motion.div
                    key={platform.name}
                    whileHover={{ scale: 1.02, y: -4 }}
                    transition={{ type: 'spring' as const, stiffness: 300, damping: 20 }}
                  >
                    <MagicCard className="border-border h-full group hover:border-primary/50 transition-all duration-300">
                      <CardHeader className="pb-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className={`bg-linear-to-br ${platform.color} p-3 rounded-xl shadow-lg`}>
                              <Icon className="h-6 w-6 text-white" />
                            </div>
                            <div>
                              <CardTitle className="text-lg mb-1">{platform.name}</CardTitle>
                              <p className="text-sm text-muted-foreground">{platform.username}</p>
                            </div>
                          </div>
                          <ExternalLink className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                        </div>
                      </CardHeader>
                      
                      <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">{platform.description}</p>
                        <Button asChild className="w-full bg-primary hover:bg-primary/90 text-primary-foreground group/btn">
                          <a
                            href={platform.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2"
                          >
                            Sponsor Now
                            <ExternalLink className="h-4 w-4 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
                          </a>
                        </Button>
                      </CardContent>
                    </MagicCard>
                  </motion.div>
                );
              })}
            </div>
          </motion.section>

          {/* Current Sponsors */}
          <motion.section variants={itemVariants}>
            <MagicCard className="border-border">
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Users className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl">Current Sponsors</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        Amazing people who support my work
                      </p>
                    </div>
                  </div>
                  {currentSponsors.length > 0 && (
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 px-4 py-1.5">
                      <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                      {currentSponsors.length} {currentSponsors.length === 1 ? 'Sponsor' : 'Sponsors'}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              
              <CardContent>
                {isLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(6)].map((_, i) => (
                      <MagicCard key={i} className="border-border">
                        <CardContent className="p-4 flex items-center gap-3">
                          <Skeleton className="h-12 w-12 rounded-full shrink-0" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-1/2" />
                          </div>
                        </CardContent>
                      </MagicCard>
                    ))}
                  </div>
                ) : error ? (
                  <div className="text-center py-12 space-y-3">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10">
                      <Users className="h-8 w-8 text-destructive" />
                    </div>
                    <p className="text-destructive font-medium">Unable to load sponsors</p>
                    <p className="text-sm text-muted-foreground">{error.message}</p>
                  </div>
                ) : !sponsorsData || currentSponsors.length === 0 ? (
                  <div className="text-center py-16 space-y-4">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted/50">
                      <Heart className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-foreground font-medium mb-2">Be the first sponsor!</p>
                      <p className="text-sm text-muted-foreground">
                        Your support would mean the world
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {sponsorsData.totalMonthlyIncome > 0 && (
                      <div className="flex items-center justify-center">
                        <MagicCard className="bg-primary/5 border-primary/20">
                          <CardContent className="p-6 text-center">
                            <p className="text-sm text-muted-foreground mb-2">Monthly Support</p>
                            <p className="text-3xl font-bold text-primary">
                              ${sponsorsData.totalMonthlyIncome}
                            </p>
                          </CardContent>
                        </MagicCard>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {currentSponsors.map((sponsor: SponsorType) => (
                        <motion.a
                          key={sponsor.login}
                          href={sponsor.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          whileHover={{ scale: 1.02 }}
                          transition={{ type: 'spring' as const, stiffness: 400, damping: 25 }}
                        >
                          <MagicCard className="border-border group hover:border-primary/50 transition-all duration-300 h-full">
                            <CardContent className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="relative h-12 w-12 shrink-0 rounded-full ring-2 ring-border group-hover:ring-primary/50 transition-all overflow-hidden">
                                  <Image
                                    src={sponsor.avatarUrl}
                                    alt={`${sponsor.name || sponsor.login}'s avatar`}
                                    fill
                                    className="object-cover"
                                    sizes="48px"
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                                    {sponsor.name || sponsor.login}
                                  </p>
                                  <p className="text-sm text-muted-foreground truncate">
                                    @{sponsor.login}
                                  </p>
                                  {sponsor.tier && (
                                    <div className="flex items-center gap-1.5 mt-1">
                                      <Heart className="h-3 w-3 text-primary" />
                                      <span className="text-xs text-primary font-medium">
                                        ${sponsor.tier.monthlyPriceInDollars}/mo
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                              </div>
                            </CardContent>
                          </MagicCard>
                        </motion.a>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </MagicCard>
          </motion.section>

          {/* Past Sponsors */}
          {pastSponsors.length > 0 && (
            <motion.section variants={itemVariants}>
              <h2 className="text-2xl font-semibold text-foreground mb-6">Past Sponsors</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Grateful for the support from these wonderful people
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
                {pastSponsors.map((sponsor) => (
                  <motion.a
                    key={sponsor.login}
                    href={sponsor.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    whileHover={{ scale: 1.1 }}
                    transition={{ type: 'spring' as const, stiffness: 400, damping: 25 }}
                    className="group"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="relative h-16 w-16 rounded-full overflow-hidden ring-2 ring-border/50">
                        <Image
                          src={sponsor.avatarUrl}
                          alt={`${sponsor.name || sponsor.login}'s avatar`}
                          fill
                          className="object-cover grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300"
                          sizes="64px"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground group-hover:text-foreground transition-colors text-center truncate w-full">
                        {sponsor.name || sponsor.login}
                      </p>
                    </div>
                  </motion.a>
                ))}
              </div>
            </motion.section>
          )}

          {/* Contact CTA */}
          <motion.section variants={itemVariants}>
            <MagicCard className="bg-linear-to-br from-primary/5 to-secondary/5 border-border">
              <CardContent className="p-8 text-center space-y-4">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-2">
                  <Mail className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    Questions About Sponsorship?
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Reach out to discuss custom sponsorship opportunities or if you have any questions
                  </p>
                </div>
                <Button
                  asChild
                  variant="outline"
                  className="border-primary text-primary hover:bg-primary/10"
                >
                  <a
                    href={emailHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2"
                  >
                    <Mail className="h-4 w-4" />
                    Contact Me
                  </a>
                </Button>
              </CardContent>
            </MagicCard>
          </motion.section>
        </motion.div>
      </div>
    </Layout>
  );
};

Sponsor.displayName = 'Sponsor';
export default Sponsor;