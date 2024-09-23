'use client';

import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Github, Linkedin, Mail } from 'lucide-react';
import Image from 'next/image';

export default function AboutPage() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <section className="w-full max-w-4xl mx-auto bg-[#1E1E1E] border-purple-800 rounded-xl overflow-hidden">
          <article className="grid gap-6 p-6">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <Image
                src="/assets/images/Profile.png"
                alt="Mike Odnis"
                width={200}
                height={200}
                className="rounded-full"
              />
              <div>
                <h2 className="text-2xl font-semibold mb-2 text-purple-300">Mike Odnis</h2>
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
                    <Github className="h-4 w-4 text-purple-300" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="bg-purple-900 hover:bg-purple-800 border-purple-700"
                    onClick={() => window.open('https://linkedin.com/in/mikeodnis', '_blank')}
                  >
                    <Linkedin className="h-4 w-4 text-purple-300" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="bg-purple-900 hover:bg-purple-800 border-purple-700"
                    onClick={() => window.open('mailto:mikeodnis3242004@gmail.com', '_blank')}
                  >
                    <Mail className="h-4 w-4 text-purple-300" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="bg-[#2a2a2a] border-purple-800">
                <CardHeader>
                  <CardTitle className="text-purple-300">Skills</CardTitle>
                </CardHeader>
                <CardContent className="text-gray-300">
                  <ul className="list-disc list-inside space-y-1">
                    <li>JavaScript, TypeScript, Python, Java, C++, C#</li>
                    <li>React, Next.js, Node.js, Express.js, Angular</li>
                    <li>HTML, CSS, SCSS, Tailwind CSS</li>
                    <li>Database Management (SQL, MongoDB)</li>
                    <li>DevOps (Docker, CI/CD)</li>
                    <li>UI/UX Design (Figma)</li>
                  </ul>
                </CardContent>
              </Card>
              <Card className="bg-[#2a2a2a] border-purple-800">
                <CardHeader>
                  <CardTitle className="text-purple-300">Education & Certifications</CardTitle>
                </CardHeader>
                <CardContent className="text-gray-300">
                  <p className="font-semibold">B.S. in Computer Science</p>
                  <p>Farmingdale State College</p>
                  <p className="text-sm text-gray-400">Expected: May 2026</p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Google Data Analytics Certification</li>
                    <li>Advanced Google Data Analytics</li>
                    <li>Google Analytics Certification</li>
                    <li>CodePath Advanced Web Development</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </article>
        </section>
      </div>
    </Layout>
  );
}
