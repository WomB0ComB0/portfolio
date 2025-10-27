'use client';

import { MagicCard } from '@/components';

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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { CardContent } from '@/components/ui/card';
import { app } from '@/constants';
import {
  ArrowRight,
  Briefcase,
  Code,
  ExternalLink,
  Github,
  Linkedin,
  Mail,
  Sparkles,
} from 'lucide-react';
import { motion } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';
import { SiGooglescholar, SiLinktree } from 'react-icons/si';

export const HomePage = () => {
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
      <div className="container mx-auto px-4 md:px-6 py-8 md:py-16 max-w-5xl">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-12 md:space-y-16"
        >
          <motion.section variants={itemVariants}>
            <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-start">
              <motion.div
                className="shrink-0 relative"
                whileHover={{ scale: 1.05 }}
                transition={{ type: 'spring' as const, stiffness: 300, damping: 20 }}
              >
                <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
                <div className="relative">
                  <Image
                    src="https://avatars.githubusercontent.com/u/95197809?v=4"
                    alt="Mike Odnis's profile picture"
                    width={160}
                    height={160}
                    className="rounded-full object-cover w-32 h-32 md:w-40 md:h-40 border-2 border-primary/30 shadow-xl relative z-10"
                    priority={true}
                    sizes="(max-width: 768px) 128px, 160px"
                    placeholder="empty"
                  />
                  <div className="absolute -bottom-2 -right-2 bg-primary text-primary-foreground p-2 rounded-full shadow-lg z-20">
                    <Code className="h-5 w-5" />
                  </div>
                </div>
              </motion.div>

              <div className="grow space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground">
                      Mike Odnis
                    </h1>
                    <Badge
                      variant="outline"
                      className="bg-primary/10 text-primary border-primary/30 flex items-center gap-1.5 px-3 py-1"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Available
                    </Badge>
                  </div>
                  <p className="text-lg md:text-xl text-muted-foreground">
                    Software Developer & Computer Science Student
                  </p>
                </div>

                <p className="text-base text-foreground/90 leading-relaxed">
                  Results-oriented Software Engineer specializing in full-stack development. I build
                  robust, scalable applications using modern technologies, driven by innovation and
                  a commitment to continuous learning.
                </p>

                <ButtonGroup className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 bg-card hover:bg-secondary border-border hover:border-primary/50 transition-all duration-200 group"
                    asChild
                  >
                    <a
                      href="https://github.com/WomB0ComB0"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Github className="h-4 w-4 group-hover:scale-110 transition-transform" />
                      GitHub
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 bg-card hover:bg-secondary border-border hover:border-primary/50 transition-all duration-200 group"
                    asChild
                  >
                    <a
                      href="https://linkedin.com/in/mikeodnis"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Linkedin className="h-4 w-4 group-hover:scale-110 transition-transform" />
                      LinkedIn
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 bg-card hover:bg-secondary border-border hover:border-primary/50 transition-all duration-200 group"
                    asChild
                  >
                    <a href={`mailto:${app.email}`} target="_blank" rel="noopener noreferrer">
                      <Mail className="h-4 w-4 group-hover:scale-110 transition-transform" />
                      Email
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 bg-card hover:bg-secondary border-border hover:border-primary/50 transition-all duration-200 group"
                    asChild
                  >
                    <a
                      href="https://scholar.google.com/citations?hl=en&authuser=1&user=P-wHEGsAAAAJ"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <SiGooglescholar className="h-4 w-4 group-hover:scale-110 transition-transform" />
                      Scholar
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 bg-card hover:bg-secondary border-border hover:border-primary/50 transition-all duration-200 group"
                    asChild
                  >
                    <a href="https://linktr.ee/mikeodnis" target="_blank" rel="noopener noreferrer">
                      <SiLinktree className="h-4 w-4 group-hover:scale-110 transition-transform" />
                      Linktree
                    </a>
                  </Button>
                </ButtonGroup>
              </div>
            </div>
          </motion.section>

          <motion.section variants={itemVariants}>
            <MagicCard className="relative overflow-hidden backdrop-blur-sm border-primary/30 hover:border-primary/50 transition-all duration-300 group">
              <CardContent className="p-6 md:p-8">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Briefcase className="h-5 w-5 text-primary" />
                      </div>
                      <h2 className="text-2xl font-semibold text-foreground">
                        Open to Opportunities
                      </h2>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                      Actively seeking freelance, part-time, or full-time roles. Let's build
                      something amazing together.
                    </p>
                  </div>
                  <Button
                    size="lg"
                    className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl hover:shadow-primary/20 transition-all duration-300 group/btn whitespace-nowrap"
                    onClick={() => window.open(`mailto:${app.email}`)}
                  >
                    <Mail className="h-4 w-4 group-hover/btn:scale-110 transition-transform" />
                    Get in Touch
                    <ArrowRight className="h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
                  </Button>
                </div>
              </CardContent>
            </MagicCard>
          </motion.section>

          <motion.section variants={itemVariants} className="space-y-6">
            <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2">
              <div className="h-1 w-8 bg-primary rounded" />
              Explore
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <motion.div
                whileHover={{ scale: 1.02, y: -4 }}
                transition={{ type: 'spring' as const, stiffness: 300, damping: 20 }}
              >
                <Link href="/experience">
                  <MagicCard className="backdrop-blur-sm border-border hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300 group h-full">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Briefcase className="h-5 w-5 text-primary" />
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                        Work Experience
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        View my professional journey and career highlights
                      </p>
                    </CardContent>
                  </MagicCard>
                </Link>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.02, y: -4 }}
                transition={{ type: 'spring' as const, stiffness: 300, damping: 20 }}
              >
                <Link href="/projects">
                  <MagicCard className="backdrop-blur-sm border-border hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300 group h-full">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Code className="h-5 w-5 text-primary" />
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                        Projects
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Explore my latest work and technical projects
                      </p>
                    </CardContent>
                  </MagicCard>
                </Link>
              </motion.div>
            </div>
          </motion.section>
        </motion.div>
      </div>
    </Layout>
  );
};
HomePage.displayName = 'HomePage';
export default HomePage;
