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

import Layout from '@/components/layout/layout';
import { Button } from '@/components/ui/button';
import { app } from '@/constants';
import { Briefcase, Github, Linkedin, Mail } from 'lucide-react';
import Image from 'next/image';
import { SiGooglescholar } from 'react-icons/si';

export const HomePage = () => {
  return (
    <Layout>
      <div className="container mx-auto px-6 py-16 max-w-4xl">
        {/* Hero Section */}
        <section className="mb-20">
          <div className="flex flex-col md:flex-row gap-12 items-start">
            <div className="flex-shrink-0">
              <Image
                src="https://avatars.githubusercontent.com/u/95197809?v=4"
                alt="Mike Odnis's profile picture"
                width={160}
                height={160}
                className="rounded-full object-cover w-40 h-40 border border-border"
                priority={true}
                sizes="160px"
                placeholder="empty"
              />
            </div>
            <div className="flex-grow">
              <h1 className="text-4xl md:text-5xl font-bold mb-4 text-foreground text-balance">
                Mike Odnis
              </h1>
              <p className="text-xl text-muted-foreground mb-6 leading-relaxed">
                Software Developer & Computer Science Student
              </p>
              <p className="text-base text-foreground leading-relaxed mb-8 max-w-2xl">
                I am a results-oriented Software Engineer and Computer Science student with a strong
                passion for building robust, scalable, and user-centric applications. Specializing
                in full-stack development, I leverage modern technologies to solve complex problems
                and deliver high-quality solutions. I am driven by innovation and committed to
                continuous learning and growth.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" size="sm" className="gap-2 bg-transparent" asChild>
                  <a href="https://github.com/WomB0ComB0" target="_blank" rel="noopener noreferrer">
                    <Github className="h-4 w-4" />
                    GitHub
                  </a>
                </Button>
                <Button variant="outline" size="sm" className="gap-2 bg-transparent" asChild>
                  <a
                    href="https://linkedin.com/in/mikeodnis"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Linkedin className="h-4 w-4" />
                    LinkedIn
                  </a>
                </Button>
                <Button variant="outline" size="sm" className="gap-2 bg-transparent" asChild>
                  <a href={`mailto:${app.email}`} target="_blank" rel="noopener noreferrer">
                    <Mail className="h-4 w-4" />
                    Email
                  </a>
                </Button>
                <Button variant="outline" size="sm" className="gap-2 bg-transparent" asChild>
                  <a
                    href="https://scholar.google.com/citations?hl=en&authuser=1&user=P-wHEGsAAAAJ"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <SiGooglescholar className="h-4 w-4" />
                    Scholar
                  </a>
                </Button>
                <Button variant="outline" size="sm" className="gap-2 bg-transparent" asChild>
                  <a href="https://linktr.ee/mikeodnis" target="_blank" rel="noopener noreferrer">
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M7.953 15.066c-.08.163-.08.324-.08.486.08.517.528.897 1.052.89h1.294v4.776c0 .486-.404.89-.89.89H6.577a.898.898 0 0 1-.889-.891v-4.774H.992c-.728 0-1.214-.729-.89-1.377l6.96-12.627a1.065 1.065 0 0 1 1.863 0l2.913 5.585-3.885 7.042zm15.945 0-6.96-12.627a1.065 1.065 0 0 0-1.862 0l-2.995 5.586 3.885 7.04c.081.164.081.326.081.487-.08.517-.529.897-1.052.89h-1.296v4.776c0 .486.404.89.89.89h2.914a.9.9 0 0 0 .892-.89v-4.775h4.612c.728 0 1.214-.729.89-1.377z" />
                    </svg>
                    Linktree
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Available for Hire CTA */}
        <section className="mb-20 p-8 bg-accent/5 border border-accent/20 rounded-lg">
          <h2 className="text-2xl font-semibold mb-3 text-foreground">
            I&apos;m available for hire
          </h2>
          <p className="text-muted-foreground mb-6 leading-relaxed">
            I am actively looking for freelance, part-time, or full-time opportunities. If you have
            a project in mind or a role to fill, let&apos;s connect.
          </p>
          <Button
            className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground"
            onClick={() => window.open(`mailto:${app.email}`)}
          >
            <Briefcase className="h-4 w-4" />
            Let&apos;s Work Together
          </Button>
        </section>
      </div>
    </Layout>
  );
};
HomePage.displayName = 'HomePage';
export default HomePage;
