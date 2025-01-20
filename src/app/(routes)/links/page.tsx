'use client';

import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { links } from '@/lib/links';
import { motion } from 'framer-motion';

const MotionButton = motion(Button);

export default function LinksPage() {
  return (
    <Layout>
      <div className="container px-4 py-8 min-h-screen flex flex-col justify-flex-start items-center">
        <Card className="w-full max-w-md mx-auto bg-gradient-to-br from-purple-900 to-purple-600 border-none shadow-2xl border border-purple-700">
          <CardHeader className="pb-4">
            <CardTitle className="text-4xl font-bold text-center text-white">My Links</CardTitle>
            <CardDescription className="text-center text-purple-200">
              Connect with me on various platforms
            </CardDescription>
          </CardHeader>
          <CardContent
            className={`
                px-5
            `}
          >
            <ScrollArea className="h-[400px] w-full pr-4 ">
              <div className="space-y-3">
                {links.map((link, index) => (
                  <MotionButton
                    key={index}
                    variant="ghost"
                    className="w-full justify-between items-center bg-purple-800/50 hover:bg-purple-700/50 text-white rounded-xl py-3 px-4"
                    onClick={() => window.open(link.url, '_blank')}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">
                        {link.icon({ className: 'text-purple-300' })}
                      </span>
                      <span className="font-medium text-lg">{link.name}</span>
                    </div>
                    <span className="text-sm text-purple-300">{link.value}</span>
                  </MotionButton>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
