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

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import type { useKBar } from 'kbar';
import Link from 'next/link';
import type React from 'react';
import { memo, useEffect, useState } from 'react';
import { FiBriefcase, FiChevronDown, FiCode, FiCommand, FiHome, FiX } from 'react-icons/fi';
import { groupNavItems } from './nav';

interface MobileMenuOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  pathname: string;
  query: ReturnType<typeof useKBar>['query'];
}

export const MobileMenuOverlay: React.FC<MobileMenuOverlayProps> = memo(
  ({ isOpen, onClose, pathname, query }) => {
    const [professionalOpen, setProfessionalOpen] = useState(false);
    const [developerOpen, setDeveloperOpen] = useState(false);
    const { professional, developer, home } = groupNavItems();

    // Prevent body scroll when menu is open
    useEffect(() => {
      if (isOpen) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
      return () => {
        document.body.style.overflow = '';
      };
    }, [isOpen]);

    return (
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-background/95"
              onClick={onClose}
              aria-hidden="true"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
              aria-label="Mobile navigation menu"
            >
              <div className="w-full max-w-md bg-card border border-border shadow-2xl rounded-3xl flex flex-col max-h-[85vh] overflow-hidden">
                <div className="flex justify-between items-center px-6 py-5 border-b border-border bg-muted/30">
                  <h2 className="text-xl font-bold text-foreground tracking-tight">Navigation</h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-foreground hover:bg-accent rounded-xl h-10 w-10 transition-colors duration-200"
                    onClick={onClose}
                    aria-label="Close menu"
                  >
                    <FiX size="1.3rem" strokeWidth={2.5} />
                  </Button>
                </div>

                <nav className="flex flex-col gap-2 overflow-y-auto flex-1 p-5" role="navigation">
                  {home && (
                    <Button
                      asChild
                      variant="ghost"
                      size="lg"
                      className={cn(
                        'flex items-center justify-start gap-3.5 text-base py-4 px-5 rounded-2xl transition-all duration-200',
                        pathname === home.slug
                          ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-md font-semibold'
                          : 'hover:bg-accent text-foreground',
                      )}
                      onClick={onClose}
                    >
                      <Link href={home.slug} className="flex items-center gap-3.5 w-full">
                        <div
                          className={cn(
                            'p-2 rounded-xl transition-colors duration-200',
                            pathname === home.slug ? 'bg-primary-foreground/20' : 'bg-primary/10',
                          )}
                        >
                          <FiHome
                            className={`text-white`}
                            size="1.25rem"
                            strokeWidth={pathname === home.slug ? 2.5 : 2}
                          />
                        </div>
                        <span className="font-medium text-white">{home.name}</span>
                      </Link>
                    </Button>
                  )}

                  <div className="flex flex-col gap-1.5">
                    <Button
                      variant="ghost"
                      size="lg"
                      onClick={() => setProfessionalOpen(!professionalOpen)}
                      className="flex items-center justify-between gap-3.5 text-base py-4 px-5 rounded-2xl hover:bg-accent transition-all duration-200"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="p-2 rounded-xl bg-primary/10">
                          <FiBriefcase size="1.25rem" className="text-white" strokeWidth={2.5} />
                        </div>
                        <span className="font-semibold text-white">Professional</span>
                      </div>
                      <motion.div
                        animate={{ rotate: professionalOpen ? 180 : 0 }}
                        transition={{ duration: 0.25 }}
                      >
                        <FiChevronDown size="1.15rem" className="text-white" strokeWidth={2.5} />
                      </motion.div>
                    </Button>

                    <AnimatePresence initial={false}>
                      {professionalOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: 'easeInOut' }}
                          className="overflow-hidden"
                        >
                          <div className="flex flex-col gap-1.5 pl-3 pt-1.5">
                            {professional.map((item, index) => (
                              <motion.div
                                key={item.slug}
                                initial={{ x: -10, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: index * 0.05 }}
                              >
                                <Button
                                  asChild
                                  variant="ghost"
                                  className={cn(
                                    'flex items-center justify-start gap-3 text-sm py-3 px-4 rounded-xl transition-all duration-200',
                                    pathname === item.slug
                                      ? 'bg-primary/15 text-primary font-semibold shadow-sm'
                                      : 'hover:bg-accent/70 text-white',
                                  )}
                                  onClick={onClose}
                                >
                                  <Link href={item.slug} className="flex items-center gap-3 w-full">
                                    <item.icon
                                      size="1.1rem"
                                      strokeWidth={pathname === item.slug ? 2.5 : 2}
                                    />
                                    <span className={`text-white`}>{item.name}</span>
                                  </Link>
                                </Button>
                              </motion.div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Button
                      variant="ghost"
                      size="lg"
                      onClick={() => setDeveloperOpen(!developerOpen)}
                      className="flex items-center justify-between gap-3.5 text-base py-4 px-5 rounded-2xl hover:bg-accent transition-all duration-200"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="p-2 rounded-xl bg-primary/10">
                          <FiCode size="1.25rem" className="text-white" strokeWidth={2.5} />
                        </div>
                        <span className="font-semibold text-white">Developer</span>
                      </div>
                      <motion.div
                        animate={{ rotate: developerOpen ? 180 : 0 }}
                        transition={{ duration: 0.25 }}
                      >
                        <FiChevronDown size="1.15rem" className="text-white" strokeWidth={2.5} />
                      </motion.div>
                    </Button>

                    <AnimatePresence initial={false}>
                      {developerOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: 'easeInOut' }}
                          className="overflow-hidden"
                        >
                          <div className="flex flex-col gap-1.5 pl-3 pt-1.5">
                            {developer.map((item, index) => (
                              <motion.div
                                key={item.slug}
                                initial={{ x: -10, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: index * 0.05 }}
                              >
                                <Button
                                  asChild
                                  variant="ghost"
                                  className={cn(
                                    'flex items-center justify-start gap-3 text-sm py-3 px-4 rounded-xl transition-all duration-200',
                                    pathname === item.slug
                                      ? 'bg-primary/15 text-primary font-semibold shadow-sm'
                                      : 'hover:bg-accent/70 text-white',
                                  )}
                                  onClick={onClose}
                                >
                                  <Link href={item.slug} className="flex items-center gap-3 w-full">
                                    <item.icon
                                      size="1.1rem"
                                      strokeWidth={pathname === item.slug ? 2.5 : 2}
                                    />
                                    <span className={`text-white`}>{item.name}</span>
                                  </Link>
                                </Button>
                              </motion.div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="mt-3 pt-4 border-t border-border/60">
                    <Button
                      variant="ghost"
                      size="lg"
                      className="flex items-center justify-start gap-3.5 text-base py-6 px-5 rounded-2xl hover:bg-accent transition-all duration-200 w-full"
                      onClick={() => {
                        query.toggle();
                        onClose();
                      }}
                      aria-label="Open command menu"
                    >
                      <div className="p-2 rounded-xl bg-primary/10">
                        <FiCommand size="1.25rem" className="text-white" strokeWidth={2.5} />
                      </div>
                      <div className="flex flex-col items-start">
                        <span className="font-semibold text-white">Command Menu</span>
                        <span className="text-xs text-white font-normal">Quick navigation</span>
                      </div>
                    </Button>
                  </div>
                </nav>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  },
);
MobileMenuOverlay.displayName = 'MobileMenuOverlay';
export default MobileMenuOverlay;
