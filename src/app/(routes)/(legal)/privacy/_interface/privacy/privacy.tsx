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

import {
  Baby,
  Database,
  ExternalLink,
  FileText,
  Lock,
  Mail,
  Share2,
  Shield,
  UserCheck,
} from 'lucide-react';
import type { JSX } from 'react';
import { MagicCard } from '@/components';
import Layout from '@/components/layout/layout';
import { Badge } from '@/components/ui/badge';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { emailHref, encodedEmail } from '@/constants';

export const Privacy = (): JSX.Element => {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-12 max-w-5xl">
        <div className="mb-12 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10 text-primary">
              <Shield className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Privacy Policy</h1>
              <p className="text-muted-foreground mt-1">
                Last Updated: <span className="font-medium">October 25, 2025</span>
              </p>
            </div>
          </div>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Your privacy is important to us. This Privacy Policy explains how we collect, use,
            disclose, and safeguard your information when you visit our website.
          </p>
        </div>

        <div className="space-y-6">
          <MagicCard className="border-2">
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 mt-1">
                  <Database className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-2xl">Information We Collect</CardTitle>
                  <CardDescription className="mt-2">
                    We collect information in various ways to provide and improve our services.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">Information You Provide to Us</h3>
                  <Badge variant="secondary">Direct Collection</Badge>
                </div>
                <ul className="space-y-3 ml-4">
                  <li className="flex gap-3">
                    <span className="text-primary mt-1">•</span>
                    <div>
                      <span className="font-semibold">Guestbook:</span> When you sign our guestbook,
                      we collect your name and email address from your authentication provider
                      (Google or GitHub), along with your message. Anonymous sign-ins use a unique
                      anonymous ID.
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-primary mt-1">•</span>
                    <div>
                      <span className="font-semibold">Contact:</span> If you contact us directly, we
                      receive your email address and any information you provide.
                    </div>
                  </li>
                </ul>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">Information We Collect Automatically</h3>
                  <Badge variant="outline">Automatic Collection</Badge>
                </div>
                <ul className="space-y-3 ml-4">
                  <li className="flex gap-3">
                    <span className="text-primary mt-1">•</span>
                    <div>
                      <span className="font-semibold">Log and Usage Data:</span> Our servers
                      automatically collect IP address, browser type, operating system, referring
                      URLs, pages viewed, and timestamps for security and operational purposes.
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-primary mt-1">•</span>
                    <div>
                      <span className="font-semibold">Analytics Data:</span> We use Google Analytics
                      and Vercel Analytics to understand visitor engagement, including device,
                      location, and browsing behavior data.
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-primary mt-1">•</span>
                    <div>
                      <span className="font-semibold">Cookies and Tracking:</span> We use cookies
                      and similar technologies to operate and personalize the website. See our{' '}
                      <a
                        href="/cookies"
                        className="text-primary hover:underline font-medium inline-flex items-center gap-1"
                      >
                        Cookie Policy
                      </a>{' '}
                      for details.
                    </div>
                  </li>
                </ul>
              </div>
            </CardContent>
          </MagicCard>

          <MagicCard className="border-2">
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500 mt-1">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-2xl">How We Use Your Information</CardTitle>
                  <CardDescription className="mt-2">
                    We use collected information to provide, improve, and protect our services.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 ml-4">
                <li className="flex gap-3">
                  <span className="text-primary mt-1">•</span>
                  <span>Provide, operate, and maintain our website</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-primary mt-1">•</span>
                  <span>Improve, personalize, and expand functionality and user experience</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-primary mt-1">•</span>
                  <span>Understand and analyze website usage through analytics</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-primary mt-1">•</span>
                  <span>Enable interactive features like Guestbook and real-time cursors</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-primary mt-1">•</span>
                  <span>
                    Protect security and integrity, including rate limiting and blocking malicious
                    IPs
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-primary mt-1">•</span>
                  <span>Respond to your comments or inquiries</span>
                </li>
              </ul>
            </CardContent>
          </MagicCard>

          <MagicCard className="border-2">
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500 mt-1">
                  <Share2 className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-2xl">Sharing of Your Information</CardTitle>
                  <CardDescription className="mt-2">
                    We do not sell your personal information. We may share information in certain
                    situations.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-3 ml-4">
                <li className="flex gap-3">
                  <span className="text-primary mt-1">•</span>
                  <div>
                    <span className="font-semibold">With Third-Party Service Providers:</span> We
                    share data with vendors performing services for us, including Vercel (hosting),
                    Firebase (authentication), Firestore (database), Google and Vercel (analytics),
                    Sentry (error monitoring), and Upstash (rate limiting)
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="text-primary mt-1">•</span>
                  <div>
                    <span className="font-semibold">By Law or to Protect Rights:</span> We may share
                    information if necessary to respond to legal process, investigate policy
                    violations, or protect rights, property, and safety of others.
                  </div>
                </li>
              </ul>
              <div className="p-4 bg-muted/50 rounded-lg border">
                <p className="text-sm text-muted-foreground">
                  <strong>Note:</strong> Any information you post in the public guestbook will be
                  visible to anyone who visits the site.
                </p>
              </div>
            </CardContent>
          </MagicCard>
          <MagicCard className="border-2">
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-green-500/10 text-green-500 mt-1">
                  <ExternalLink className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-2xl">Third-Party Services</CardTitle>
                  <CardDescription className="mt-2">
                    This site integrates with several third-party services governed by their own
                    privacy policies.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {[
                  {
                    name: 'Google',
                    purpose: 'Firebase and Analytics',
                    url: 'https://policies.google.com/privacy',
                  },
                  {
                    name: 'Vercel',
                    purpose: 'Hosting and Analytics',
                    url: 'https://vercel.com/legal/privacy-policy',
                  },
                  {
                    name: 'Sentry',
                    purpose: 'Error Monitoring',
                    url: 'https://sentry.io/privacy/',
                  },
                  {
                    name: 'Upstash',
                    purpose: 'Rate Limiting',
                    url: 'https://upstash.com/privacy',
                  },
                ].map((service) => (
                  <a
                    key={service.name}
                    href={service.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent transition-colors group"
                  >
                    <div>
                      <span className="font-semibold">{service.name}</span>
                      <span className="text-muted-foreground text-sm ml-2">
                        ({service.purpose})
                      </span>
                    </div>
                    <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </a>
                ))}
              </div>
            </CardContent>
          </MagicCard>
          <MagicCard className="border-2">
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-red-500/10 text-red-500 mt-1">
                  <Lock className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-2xl">Data Security and Retention</CardTitle>
                  <CardDescription className="mt-2">
                    We implement security measures to protect your personal information.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground leading-relaxed">
                We use administrative, technical, and physical security measures to help protect
                your personal information. While we have taken reasonable steps to secure your data,
                please be aware that no security measures are perfect or impenetrable.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                We retain your information only for as long as necessary for the purposes set out in
                this policy. For example, guestbook messages are stored indefinitely unless a
                deletion is requested.
              </p>
            </CardContent>
          </MagicCard>
          <MagicCard className="border-2">
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-500 mt-1">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-2xl">Your Data Rights</CardTitle>
                  <CardDescription className="mt-2">
                    Depending on your location, you may have certain rights regarding your personal
                    data.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 ml-4">
                <li className="flex gap-3">
                  <span className="text-primary mt-1">•</span>
                  <div>
                    <span className="font-semibold">Right to Access:</span> Request copies of your
                    personal data
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="text-primary mt-1">•</span>
                  <div>
                    <span className="font-semibold">Right to Rectification:</span> Request
                    correction of inaccurate information
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="text-primary mt-1">•</span>
                  <div>
                    <span className="font-semibold">Right to Erasure:</span> Request deletion of
                    your personal data under certain conditions
                  </div>
                </li>
              </ul>
              <div className="mt-4 p-4 bg-muted/50 rounded-lg border">
                <p className="text-sm text-muted-foreground">
                  To exercise any of these rights, such as requesting deletion of a guestbook
                  message, please contact us using the information below.
                </p>
              </div>
            </CardContent>
          </MagicCard>
          <MagicCard className="border-2">
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-pink-500/10 text-pink-500 mt-1">
                  <Baby className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-2xl">Children's Privacy</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">
                This website is not intended for children under the age of 13, and we do not
                knowingly collect personal information from children under 13. If we learn that we
                have collected personal information from a child under 13, we will take steps to
                delete such information from our files as soon as possible.
              </p>
            </CardContent>
          </MagicCard>
          <MagicCard className="border-2">
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-500 mt-1">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-2xl">Changes to This Privacy Policy</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of any
                changes by posting the new Privacy Policy on this page and updating the "Last
                Updated" date.
              </p>
            </CardContent>
          </MagicCard>
          <MagicCard className="border-2 bg-primary/5">
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary mt-1">
                  <Mail className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-2xl">Contact Us</CardTitle>
                  <CardDescription className="mt-2">
                    Questions or comments about this Privacy Policy?
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <a
                href={emailHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-lg font-medium text-primary hover:underline"
              >
                <span aria-label="email" dangerouslySetInnerHTML={{ __html: encodedEmail }} />

                <ExternalLink className="w-4 h-4" />
              </a>
            </CardContent>
          </MagicCard>
        </div>
      </div>
    </Layout>
  );
};

Privacy.displayName = 'Privacy';
export default Privacy;
