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

/**
 * @file /sponsor as a server component, everything in the server HTML: no hydration gate, no
 * entrance animation. The header, benefits, platforms and contact card are static and never wait
 * on GitHub. Only the sponsors block does, as an async child behind its own Suspense and error
 * boundary (see Sponsors), so a slow or failing GitHub costs that block alone.
 */

import { Coffee, ExternalLink, Gift, Heart, Mail, Users } from 'lucide-react';
import { type ReactElement, Suspense } from 'react';
import { SiBuymeacoffee, SiGithubsponsors, SiKofi, SiOpencollective } from 'react-icons/si';

import { SponsorListsSkeleton } from '@/app/(routes)/(dev)/sponsor/_components/sponsor-lists';
import { Sponsors } from '@/app/(routes)/(dev)/sponsor/_components/sponsors';
import { PageHeader } from '@/components/custom/page-header';
import { SectionBoundary } from '@/components/data/section-boundary';
import { MagicCard } from '@/components/magicui/magic-card';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { emailHref } from '@/constants/app';

import type { BenefitItem, SponsorPlatform } from './sponsor.types';

const PAGE_TITLE = 'Sponsor My Work';
const PAGE_DESCRIPTION =
  'Your support helps me build open-source projects, create educational content, and contribute to the developer community.';
/** The error boundary's fallback reads "Couldn't load sponsors", as the block's own error does. */
const SPONSORS_SECTION_LABEL = 'sponsors';

const sponsorPlatforms: readonly SponsorPlatform[] = [
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
];

const benefits: readonly BenefitItem[] = [
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
];

/** The page's h1. */
function SponsorHeader(): ReactElement {
  return <PageHeader title={PAGE_TITLE} description={PAGE_DESCRIPTION} icon={<Heart />} />;
}

function BenefitsSection(): ReactElement {
  return (
    <section>
      <h2 className="text-2xl font-semibold text-foreground mb-6">Why Sponsor?</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {benefits.map((benefit) => (
          <MagicCard key={benefit.title} className="border-border">
            <CardContent className="p-6 text-center space-y-3">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
                <benefit.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">{benefit.title}</h3>
              <p className="text-sm text-muted-foreground">{benefit.description}</p>
            </CardContent>
          </MagicCard>
        ))}
      </div>
    </section>
  );
}

function PlatformTile({ platform }: { platform: SponsorPlatform }): ReactElement {
  return (
    <a
      href={platform.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block transition-transform duration-300 motion-safe:hover:scale-[1.02]"
    >
      <MagicCard className="border-border group hover:border-primary/50 transition-all duration-300 h-full">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div
              className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-linear-to-br ${platform.color} shrink-0`}
            >
              <platform.icon className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  {platform.name}
                </h3>
                <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <p className="text-sm text-muted-foreground mt-1">{platform.username}</p>
              <p className="text-sm text-muted-foreground mt-2">{platform.description}</p>
            </div>
          </div>
        </CardContent>
      </MagicCard>
    </a>
  );
}

function PlatformsSection(): ReactElement {
  return (
    <section>
      <h2 className="text-2xl font-semibold text-foreground mb-6">Ways to Sponsor</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sponsorPlatforms.map((platform) => (
          <PlatformTile key={platform.name} platform={platform} />
        ))}
      </div>
    </section>
  );
}

function ContactSection(): ReactElement {
  return (
    <section>
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
    </section>
  );
}

/**
 * The sponsor page body. Everything but the sponsors block is static and renders at once; the
 * block streams in behind its skeleton, and a failure or a missed deadline stays inside it.
 */
export const Sponsor = (): ReactElement => (
  <div className="container mx-auto px-4 md:px-6 py-12 max-w-6xl">
    <div className="space-y-12">
      <SponsorHeader />
      <BenefitsSection />
      <PlatformsSection />
      <SectionBoundary label={SPONSORS_SECTION_LABEL}>
        <Suspense fallback={<SponsorListsSkeleton />}>
          <Sponsors />
        </Suspense>
      </SectionBoundary>
      <ContactSection />
    </div>
  </div>
);

Sponsor.displayName = 'Sponsor';
export default Sponsor;
