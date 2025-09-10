'use client'; // Required for onClick handlers in buttons

import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Github, Linkedin, Mail } from 'lucide-react';
import { SiGooglescholar } from 'react-icons/si';
import Image from 'next/image';
import Link from 'next/link'; // Added import for navigation links

export default function Home() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <section className="w-full max-w-4xl mx-auto bg-[#1E1E1E] border border-purple-800 rounded-xl overflow-hidden">
          <article className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row items-start gap-6">
              <div className="flex-shrink-0">
                <Image
                  src="https://github.com/WomB0ComB0.png" // Updated image path
                  alt="Mike Odnis"
                  width={200}
                  height={200}
                  className="rounded-full object-cover w-48 h-48"
                  priority // Added priority as it's LCP
                />
              </div>
              <div className="flex-grow">
                <h2 className="text-3xl font-semibold mb-2 text-purple-300">Mike Odnis</h2>
                <p className="text-gray-300 mb-4">
                  I am an ambitious and driven undergraduate Computer Science student specializing
                  in web development and programming. With a solid foundation in various programming
                  languages and frameworks, I craft beautiful, user-friendly websites and
                  applications. As a quick learner and first-generation student, I take pride in my
                  achievements and aim to be a well-rounded addition to any team.
                </p>
                <div className="flex gap-4">
                  <Button
                    variant="outline"
                    size="icon"
                    className="bg-purple-900 hover:bg-purple-800 border-purple-700"
                    onClick={() => window.open('https://github.com/WomB0ComB0', '_blank')}
                  >
                    <Github className="h-5 w-5 text-purple-300" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="bg-purple-900 hover:bg-purple-800 border-purple-700"
                    onClick={() => window.open('https://linkedin.com/in/mikeodnis', '_blank')}
                  >
                    <Linkedin className="h-5 w-5 text-purple-300" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="bg-purple-900 hover:bg-purple-800 border-purple-700"
                    onClick={() => window.open('mailto:mike.odnis@mikeodnis.dev', '_blank')}
                  >
                    <Mail className="h-5 w-5 text-purple-300" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="bg-purple-900 hover:bg-purple-800 border-purple-700"
                    onClick={() => window.open('https://scholar.google.com/citations?hl=en&authuser=1&user=P-wHEGsAAAAJ', '_blank')}
                  >
                    <SiGooglescholar className="h-5 w-5 text-purple-300" />
                  </Button>
                </div>
              </div>
            </div>
            {/* Adjusted grid for Skills card - now it will take full width in this specific layout */}
            <div className="grid gap-6 md:grid-cols-1">
              <Card className="bg-[#2a2a2a] border-purple-800">
                <CardHeader>
                  <CardTitle className="text-purple-300">Skills</CardTitle>
                </CardHeader>
                <CardContent className="text-gray-300">
                  <ul className="list-disc list-inside space-y-2">
                    <li>JavaScript, TypeScript, Python, Java, C++, C#</li>
                    <li>React, Next.js, Node.js, Express.js, Angular</li>
                    <li>HTML, CSS, SCSS, Tailwind CSS</li>
                    <li>Database Management (SQL, MongoDB)</li>
                    <li>DevOps (Docker, CI/CD)</li>
                    <li>UI/UX Design (Figma)</li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Links to dedicated pages */}
            <div className="mt-10 pt-6 border-t border-purple-700 text-center">
              <p className="text-gray-300 mb-3 text-lg">
                Dive deeper into my professional journey:
              </p>
              <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                <Link href="/experience" passHref legacyBehavior>
                  <Button variant="outline" className="text-purple-300 border-purple-600 hover:bg-purple-800 hover:border-purple-500 w-full sm:w-auto">
                    View Work Experience
                  </Button>
                </Link>
                <Link href="/certifications" passHref legacyBehavior>
                  <Button variant="outline" className="text-purple-300 border-purple-600 hover:bg-purple-800 hover:border-purple-500 w-full sm:w-auto">
                    Explore Certifications
                  </Button>
                </Link>
                <Link href="/projects" passHref legacyBehavior>
                  <Button variant="outline" className="text-purple-300 border-purple-600 hover:bg-purple-800 hover:border-purple-500 w-full sm:w-auto">
                    Discover My Projects
                  </Button>
                </Link>
              </div>
            </div>
          </article>
        </section>
      </div>
    </Layout>
  );
}
