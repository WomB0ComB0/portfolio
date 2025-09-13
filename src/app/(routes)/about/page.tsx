'use client';

import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Github, Linkedin, Mail, Briefcase } from 'lucide-react';
import { SiGooglescholar } from 'react-icons/si';
import Image from 'next/image';

export default function AboutPage() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <section className="w-full max-w-5xl mx-auto bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border border-purple-700 rounded-2xl overflow-hidden shadow-2xl">
          <article className="p-8 space-y-8">
            <div className="flex flex-col lg:flex-row items-center gap-8">
              <div className="flex-shrink-0 relative group">
                <Image
                  src="/assets/images/Profile.png"
                  alt="Mike Odnis"
                  width={250}
                  height={250}
                  className="rounded-full object-cover w-56 h-56 lg:w-64 lg:h-64 border-4 border-purple-500 shadow-lg group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <span className="text-white text-lg font-semibold">Mike Odnis</span>
                </div>
              </div>
              <div className="flex-grow text-center lg:text-left">
                <h2 className="text-4xl font-bold mb-3 text-purple-300 tracking-wider">
                  Mike Odnis
                </h2>
                <h3 className="text-xl font-medium text-purple-400 mb-4">
                  Software Developer & Computer Science Student
                </h3>
                <p className="text-gray-300 mb-6 leading-relaxed">
                  I am a passionate and driven undergraduate Computer Science student with a strong specialization in full-stack web development. My journey in technology is fueled by a desire to build beautiful, intuitive, and high-performance applications. As a first-generation student, I am proud of my accomplishments and continuously strive to learn and grow. I am a quick learner, a collaborative team player, and I am currently seeking new opportunities to apply my skills and contribute to innovative projects.
                </p>
                <div className="flex justify-center lg:justify-start gap-4 flex-wrap">
                  <Button
                    variant="outline"
                    className="bg-purple-800 hover:bg-purple-700 border-purple-600 text-purple-300"
                    onClick={() => window.open('https://github.com/WomB0ComB0', '_blank')}
                  >
                    <Github className="h-5 w-5 mr-2" />
                    GitHub
                  </Button>
                  <Button
                    variant="outline"
                    className="bg-blue-800 hover:bg-blue-700 border-blue-600 text-blue-300"
                    onClick={() => window.open('https://linkedin.com/in/mikeodnis', '_blank')}
                  >
                    <Linkedin className="h-5 w-5 mr-2" />
                    LinkedIn
                  </Button>
                  <Button
                    variant="outline"
                    className="bg-red-800 hover:bg-red-700 border-red-600 text-red-300"
                    onClick={() => window.open('mailto:mike.odnis@mikeodnis.dev', '_blank')}
                  >
                    <Mail className="h-5 w-5 mr-2" />
                    Email
                  </Button>
                  <Button
                    variant="outline"
                    className="bg-gray-700 hover:bg-gray-600 border-gray-500 text-gray-300"
                    onClick={() => window.open('https://scholar.google.com/citations?hl=en&authuser=1&user=P-wHEGsAAAAJ', '_blank')}
                  >
                    <SiGooglescholar className="h-5 w-5 mr-2" />
                    Scholar
                  </Button>
                </div>
              </div>
            </div>

            <div className="bg-purple-900 bg-opacity-30 p-6 rounded-lg text-center">
              <h3 className="text-2xl font-semibold text-purple-300 mb-2">I&apos;m available for hire!</h3>
              <p className="text-purple-400 mb-4">I am actively looking for freelance, part-time, or full-time opportunities. <br/> If you have a project in mind or a role to fill, let&apos;s connect!</p>
              <Button
                className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded-lg shadow-lg"
                onClick={() => window.open('mailto:mike.odnis@mikeodnis.dev')}
              >
                <Briefcase className="h-5 w-5 mr-2" />
                Let&apos;s Work Together
              </Button>
            </div>

            <div className="grid gap-8 md:grid-cols-2">
              <Card className="bg-[#2a2a2a] border-purple-800 transform hover:scale-105 transition-transform duration-300">
                <CardHeader>
                  <CardTitle className="text-purple-300 text-2xl">Core Competencies</CardTitle>
                </CardHeader>
                <CardContent className="text-gray-300">
                  <ul className="space-y-3">
                    <li className="flex items-center"><span className="font-bold text-purple-400 mr-2">Languages:</span> JavaScript, TypeScript, Python, Java, C++, C#</li>
                    <li className="flex items-center"><span className="font-bold text-purple-400 mr-2">Frameworks:</span> React, Next.js, Node.js, Express.js, Angular</li>
                    <li className="flex items-center"><span className="font-bold text-purple-400 mr-2">Web Tech:</span> HTML, CSS, SCSS, Tailwind CSS</li>
                    <li className="flex items-center"><span className="font-bold text-purple-400 mr-2">Databases:</span> SQL, MongoDB, PostgreSQL</li>
                    <li className="flex items-center"><span className="font-bold text-purple-400 mr-2">DevOps:</span> Docker, CI/CD, GitHub Actions</li>
                    <li className="flex items-center"><span className="font-bold text-purple-400 mr-2">Design:</span> Figma, UI/UX Principles</li>
                  </ul>
                </CardContent>
              </Card>
              <Card className="bg-[#2a2a2a] border-purple-800 transform hover:scale-105 transition-transform duration-300">
                <CardHeader>
                  <CardTitle className="text-purple-300 text-2xl">Education & Credentials</CardTitle>
                </CardHeader>
                <CardContent className="text-gray-300">
                  <div className="mb-4">
                    <p className="font-semibold text-lg">B.S. in Computer Science</p>
                    <p className="text-purple-400">Farmingdale State College</p>
                    <p className="text-sm text-gray-400">Expected Graduation: May 2026</p>
                  </div>
                  <div>
                    <p className="font-semibold text-lg mb-2">Certifications</p>
                    <ul className="list-disc list-inside space-y-2">
                      <li>Google Data Analytics Certification</li>
                      <li>Advanced Google Data Analytics</li>
                      <li>Google Analytics Certification</li>
                      <li>CodePath Advanced Web Development</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </article>
        </section>
      </div>
    </Layout>
  );
}
