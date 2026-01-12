'use client';

/**
Copyright 2025 Mike Odnis
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at
http://www.apache.org/licenses/LICENSE-2.0
*/

import { Cookie, ExternalLink, Gauge, Palette, Shield } from 'lucide-react';
import type { JSX } from 'react';
import { MagicCard } from '@/components';
import Layout from '@/components/layout/layout';
import { Badge } from '@/components/ui/badge';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { emailHref, encodedEmail } from '@/constants';

export const Cookies = (): JSX.Element => {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="mb-12 space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
              <Cookie className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight">Cookies Policy</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            <strong>Last Updated:</strong> October 25, 2025
          </p>
          <p className="text-foreground/80 leading-relaxed">
            This Cookie Policy explains how Mike Odnis ("we", "us", and "our") uses cookies and
            similar technologies to recognize you when you visit our website at
            wombo-comb0-portfolio.vercel.app. It explains what these technologies are and why we use
            them, as well as your rights to control our use of them.
          </p>
        </div>

        <div className="space-y-8">
          <MagicCard className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl">What Are Cookies?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground/80 leading-relaxed">
                Cookies are small data files that are placed on your computer or mobile device when
                you visit a website. Cookies are widely used by website owners in order to make
                their websites work, or to work more efficiently, as well as to provide reporting
                information.
              </p>
            </CardContent>
          </MagicCard>

          <MagicCard className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl">How We Use Cookies</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground/80 leading-relaxed">
                We use first-party and third-party cookies for several reasons. Some cookies are
                required for technical reasons in order for our Website to operate, and we refer to
                these as "essential" or "strictly necessary" cookies. Other cookies also enable us
                to track and target the interests of our users to enhance the experience on our
                Website. Third parties serve cookies through our Website for analytics and other
                purposes.
              </p>
            </CardContent>
          </MagicCard>

          <div className="space-y-6">
            <h2 className="text-3xl font-bold tracking-tight">Types of Cookies We Use</h2>
            <p className="text-foreground/80 leading-relaxed">
              The specific types of first and third-party cookies served through our Website and the
              purposes they perform are described below:
            </p>

            <MagicCard className="border-border/50 shadow-sm">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 mt-1">
                    <Shield className="w-5 h-5 text-red-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-xl">Strictly Necessary Cookies</CardTitle>
                      <Badge variant="destructive" className="text-xs">
                        Required
                      </Badge>
                    </div>
                    <CardDescription className="text-base">
                      These cookies are essential to provide you with services available through our
                      Website and to enable you to use some of its features, such as access to
                      secure areas.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-semibold text-foreground flex items-center gap-2">
                    Firebase Authentication
                  </h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    We use Firebase to authenticate users for the Guestbook feature. Firebase sets
                    cookies to manage your login session securely. Without these, you would not be
                    able to sign in.
                  </p>
                </div>
                <Separator />
                <div className="space-y-2">
                  <h4 className="font-semibold text-foreground flex items-center gap-2">
                    CSRF Token
                  </h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    We use a{' '}
                    <code className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">
                      csrfToken
                    </code>{' '}
                    cookie as part of our security measures to protect against Cross-Site Request
                    Forgery (CSRF) attacks when you submit forms, like signing the guestbook.
                  </p>
                </div>
              </CardContent>
            </MagicCard>

            <MagicCard className="border-border/50 shadow-sm">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 mt-1">
                    <Palette className="w-5 h-5 text-blue-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-xl">Functionality Cookies</CardTitle>
                      <Badge variant="secondary" className="text-xs">
                        Optional
                      </Badge>
                    </div>
                    <CardDescription className="text-base">
                      These cookies are used to enhance the performance and functionality of our
                      Website but are non-essential to their use. However, without these cookies,
                      certain functionality may become unavailable.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <h4 className="font-semibold text-foreground flex items-center gap-2">
                    Theme Preference
                  </h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    We use a cookie (typically named{' '}
                    <code className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">theme</code>)
                    to remember your preferred theme (light or dark mode) across visits.
                  </p>
                </div>
              </CardContent>
            </MagicCard>

            <MagicCard className="border-border/50 shadow-sm">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20 mt-1">
                    <Gauge className="w-5 h-5 text-green-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-xl">Performance and Analytics Cookies</CardTitle>
                      <Badge variant="secondary" className="text-xs">
                        Optional
                      </Badge>
                    </div>
                    <CardDescription className="text-base">
                      These cookies collect information that is used either in aggregate form to
                      help us understand how our Website is being used or how effective our
                      marketing campaigns are, or to help us customize our Website for you.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-semibold text-foreground flex items-center gap-2">
                    Google Analytics
                  </h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    We use Google Analytics to collect information about your use of the Website.
                    This helps us understand traffic patterns and improve the site. Google Analytics
                    may set cookies like{' '}
                    <code className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">_ga</code>{' '}
                    and{' '}
                    <code className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">_gid</code>{' '}
                    to distinguish users.
                  </p>
                </div>
                <Separator />
                <div className="space-y-2">
                  <h4 className="font-semibold text-foreground flex items-center gap-2">
                    Vercel Analytics
                  </h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    As part of our hosting, Vercel collects analytics data to provide insights into
                    website traffic and performance. Vercel's analytics are designed to be
                    privacy-friendly and do not use cookies for tracking visitors. Instead, they use
                    a hash created from the incoming request.
                  </p>
                </div>
                <Separator />
                <div className="space-y-2">
                  <h4 className="font-semibold text-foreground flex items-center gap-2">
                    Vercel Speed Insights
                  </h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    This service helps us monitor and improve the performance of our website by
                    collecting Core Web Vitals. It does not rely on traditional tracking cookies.
                  </p>
                </div>
              </CardContent>
            </MagicCard>
          </div>

          <MagicCard className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl">Your Choices and How to Manage Cookies</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-foreground/80 leading-relaxed">
                You have the right to decide whether to accept or reject cookies. You can exercise
                your cookie preferences by setting or amending your web browser controls.
              </p>
              <p className="text-foreground/80 leading-relaxed">
                Most web browsers allow some control of most cookies through the browser settings.
                To find out more about cookies, including how to see what cookies have been set,
                visit{' '}
                <a
                  href="https://www.aboutcookies.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  www.aboutcookies.org
                  <ExternalLink className="w-3 h-3" />
                </a>{' '}
                or{' '}
                <a
                  href="https://www.allaboutcookies.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  www.allaboutcookies.org
                  <ExternalLink className="w-3 h-3" />
                </a>
                {'.'}
              </p>
              <div className="space-y-3 pt-2">
                <p className="font-semibold text-foreground">
                  Find out how to manage cookies on popular browsers:
                </p>
                <ul className="space-y-2 pl-4">
                  {[
                    {
                      name: 'Google Chrome',
                      url: 'https://support.google.com/chrome/answer/95647',
                    },
                    {
                      name: 'Microsoft Edge',
                      url: 'https://support.microsoft.com/en-us/windows/delete-and-manage-cookies-168dab11-0753-043d-7c16-ede5947fc64d',
                    },
                    {
                      name: 'Mozilla Firefox',
                      url: 'https://support.mozilla.org/en-US/kb/enhanced-tracking-protection-firefox-desktop',
                    },
                    {
                      name: 'Apple Safari',
                      url: 'https://support.apple.com/guide/safari/manage-cookies-and-website-data-sfri11471/mac',
                    },
                  ].map((browser) => (
                    <li key={browser.name}>
                      <a
                        href={browser.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1.5 text-sm"
                      >
                        {browser.name}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-muted/50 border border-border/50 rounded-lg p-4 mt-4">
                <p className="text-sm text-foreground/80 leading-relaxed">
                  <strong>Note:</strong> If you choose to reject cookies, you may still use our
                  website though your access to some functionality and areas may be restricted. For
                  example, you will not be able to sign the guestbook.
                </p>
              </div>
            </CardContent>
          </MagicCard>

          <MagicCard className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl">Changes to This Cookie Policy</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground/80 leading-relaxed">
                We may update this Cookie Policy from time to time in order to reflect, for example,
                changes to the cookies we use or for other operational, legal or regulatory reasons.
                Please therefore re-visit this Cookie Policy regularly to stay informed about our
                use of cookies and related technologies.
              </p>
            </CardContent>
          </MagicCard>

          <MagicCard className="border-border/50 shadow-sm bg-muted/30">
            <CardHeader>
              <CardTitle className="text-2xl">Contact Us</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground/80 leading-relaxed">
                If you have any questions about our use of cookies or other technologies, please
                email us at{' '}
                <a
                  href={emailHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-medium"
                >
                  {encodedEmail.replaceAll(/&#(\d+);/g, (_match, dec) => String.fromCodePoint(dec))}
                </a>
                {'.'}
              </p>
            </CardContent>
          </MagicCard>
        </div>
      </div>
    </Layout>
  );
};

Cookies.displayName = 'Cookies';
export default Cookies;
