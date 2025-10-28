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

import Layout from '@/components/layout/layout';
import { BlurFade, DotPattern, MagicCard } from '@/components/magicui';
import { Button } from '@/components/ui/button';
import { LayoutTextFlip } from '@/components/ui/layout-text-flip';
import { app } from '@/constants';
import { get } from '@/lib/http-clients/effect-fetcher';
import { cn } from '@/lib/utils';
import { FetchHttpClient } from '@effect/platform';
import { useQuery } from '@tanstack/react-query';
import { Effect, pipe, Schema } from 'effect';
import {
  ArrowRight,
  Briefcase,
  Code,
  FileText,
  Github,
  Linkedin,
  Mail,
  Music,
  User,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { JSX } from 'react';
import { SiSpotify } from 'react-icons/si';

// A new, styled DashboardCard to match your design
const DashboardCard = ({
  icon,
  title,
  description,
  href,
  className,
  children,
}: {
  icon?: JSX.Element;
  title?: string;
  description?: string;
  href?: string;
  className?: string;
  children?: React.ReactNode;
}) => (
  <BlurFade inView className="h-full">
    <Link href={href || '#'} className={cn('block h-full', !href && 'pointer-events-none')}>
      <MagicCard
        className={cn(
          'group h-full rounded-xl border border-white/10 p-6 transition-all duration-300 hover:border-primary/80 hover:shadow-2xl hover:shadow-primary/10',
          className,
        )}
      >
        {children || (
          <div className="flex flex-col justify-between h-full">
            <div>
              <div className="mb-4 h-10 w-10 rounded-lg bg-white/5 flex items-center justify-center text-primary">
                {icon}
              </div>
              <h3 className="text-lg font-bold text-white">{title}</h3>
              <p className="text-sm text-neutral-400 mt-1">{description}</p>
            </div>
            {href && (
              <div className="mt-4 flex items-center text-sm font-medium text-neutral-400 transition-colors duration-300 group-hover:text-primary">
                Read More <ArrowRight className="ml-2 h-4 w-4" />
              </div>
            )}
          </div>
        )}
      </MagicCard>
    </Link>
  </BlurFade>
);

// NowPlaying card adapted to the new design
const NowPlayingCard = () => {
  const NowPlayingSchema = Schema.Struct({
    isPlaying: Schema.Boolean,
    songName: Schema.optional(Schema.String),
    artistName: Schema.optional(Schema.String),
    songURL: Schema.optional(Schema.String),
    imageURL: Schema.optional(Schema.String),
  });

  const { data } = useQuery({
    queryKey: ['now-playing-homepage'],
    queryFn: async () => {
      const effect = pipe(
        get('/api/v1/now-playing', { schema: NowPlayingSchema, retries: 1, timeout: 5000 }),
        Effect.provide(FetchHttpClient.layer),
      );
      return await Effect.runPromise(effect);
    },
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 30,
  });

  return (
    <DashboardCard className="p-4" href={data?.songURL}>
      <div className="flex items-center gap-4">
        {data?.imageURL ? (
          <Image
            src={data.imageURL}
            alt={data.songName || 'Album art'}
            width={56}
            height={56}
            className="rounded-md h-14 w-14"
          />
        ) : (
          <div className="h-14 w-14 flex items-center justify-center bg-white/5 rounded-md text-neutral-500">
            <SiSpotify className="h-6 w-6" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">
            {data?.isPlaying ? data.songName : 'Not Currently Listening'}
          </p>
          <p className="text-xs text-neutral-400 truncate">
            {data?.isPlaying ? data.artistName : 'Spotify'}
          </p>
        </div>
        {data?.isPlaying && <Music className="h-5 w-5 text-green-500 animate-pulse" />}
      </div>
    </DashboardCard>
  );
};

const HomePage = () => {
  return (
    <Layout>
      <div className="relative min-h-screen">
        <DotPattern className="absolute inset-0 h-full w-full opacity-[0.03] pointer-events-none mask-[radial-gradient(ellipse_at_center,white,transparent_80%)]" />

        <div className="container mx-auto max-w-5xl px-4 py-16 md:py-24 space-y-24">
          <section className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 items-center">
            <BlurFade delay={0.1} inView>
              <div className="relative mx-auto w-40 h-40 md:w-48 md:h-48">
                <Image
                  src="https://avatars.githubusercontent.com/u/95197809?v=4"
                  alt="Mike Odnis's profile picture"
                  width={192}
                  height={192}
                  className="rounded-full object-cover w-full h-full border-2 border-primary/50 shadow-2xl"
                  priority
                  sizes="(max-width: 768px) 160px, 192px"
                />
              </div>
            </BlurFade>

            <div className="md:col-span-2 text-center md:text-left space-y-6">
              <BlurFade delay={0.2} inView className="flex flex-col items-center md:items-start">
                <LayoutTextFlip
                  text="Mike Odnis"
                  words={['Mobile', 'Fullstack', 'Cybersecurity', 'Cloud', 'AI', 'DevOps']}
                  className="flex-col md:flex-row items-center gap-y-2"
                />
                <p className="text-lg text-neutral-400 mt-2">Engineer</p>
              </BlurFade>
              <BlurFade delay={0.3} inView>
                <p className="text-neutral-300 leading-relaxed max-w-lg mx-auto md:mx-0">
                  I build robust, scalable, and user-centric applications. With a foundation in
                  computer science and a passion for modern technology, I turn complex problems into
                  elegant software solutions.
                </p>
              </BlurFade>
              <BlurFade
                delay={0.4}
                inView
                className="flex justify-center md:justify-start flex-wrap gap-3"
              >
                <Button asChild className="bg-primary/90 text-white hover:bg-primary rounded-lg">
                  <a href={`mailto:${app.email}`}>
                    <Mail className="mr-2 h-4 w-4" /> Get in Touch
                  </a>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="bg-white/5 border-white/10 hover:bg-white/10 hover:text-white rounded-lg"
                >
                  <a href="https://github.com/WomB0ComB0" target="_blank" rel="noopener noreferrer">
                    <Github className="mr-2 h-4 w-4" /> GitHub
                  </a>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="bg-white/5 border-white/10 hover:bg-white/10 hover:text-white rounded-lg"
                >
                  <a
                    href="https://linkedin.com/in/mikeodnis"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Linkedin className="mr-2 h-4 w-4" /> LinkedIn
                  </a>
                </Button>
              </BlurFade>
            </div>
          </section>

          <section>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-[1fr]">
              <DashboardCard
                href="/projects"
                icon={<Code className="h-6 w-6" />}
                title="Featured Projects"
                description="Explore my portfolio of web apps, mobile solutions, and technical experiments."
                className="sm:col-span-2"
              />
              <DashboardCard
                href="/experience"
                icon={<Briefcase className="h-6 w-6" />}
                title="Work Experience"
                description="A timeline of my professional journey and career milestones."
              />
              <DashboardCard
                icon={<User className="h-6 w-6" />}
                title="About Me"
                description="Driven by a passion for continuous learning and building impactful technology."
              />
              <div className="sm:col-span-2 flex flex-col gap-6">
                <NowPlayingCard />
                <DashboardCard
                  href="/resume"
                  icon={<FileText className="h-6 w-6" />}
                  title="View My Resume"
                  description="Get a detailed overview of my skills, education, and professional background."
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
};

HomePage.displayName = 'HomePage';
export default HomePage;
