import type { MobileMenuOverlayProps } from './mobile-menu-overlay.types';

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

('use client');

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import type React from 'react';
import { memo, useEffect, useState } from 'react';
import { FaGavel } from 'react-icons/fa';
import { FiBriefcase, FiChevronDown, FiCode, FiCommand, FiHome, FiUser, FiX } from 'react-icons/fi';
import { groupNavItems } from './nav';
export const MobileMenuOverlay: React.FC<MobileMenuOverlayProps> = memo(
  ({ isOpen, onClose, pathname, query }) => {
    const [professionalOpen, setProfessionalOpen] = useState(false);
    const [developerOpen, setDeveloperOpen] = useState(false);
    const [personalOpen, setPersonalOpen] = useState(false);
    const [legalOpen, setLegalOpen] = useState(false);
    const { professional, developer, home, personal, legal } = groupNavItems();

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
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
              onClick={onClose}
              aria-hidden="true"
            />

            {/* Slide-in Menu */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 35, stiffness: 350 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-card/95 backdrop-blur-xl border-l border-border/40 shadow-2xl flex flex-col"
              role="dialog"
              aria-modal="true"
              aria-label="Mobile navigation menu"
            >
              {/* Header */}
              <div className="flex justify-between items-center px-6 py-5 border-b border-border/40">
                <h2 className="text-lg font-semibold text-foreground">Navigation</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-foreground hover:bg-accent/70 rounded-xl h-10 w-10"
                  onClick={onClose}
                  aria-label="Close menu"
                >
                  <FiX size="1.35rem" />
                </Button>
              </div>

              {/* Navigation Content */}
              <nav className="flex flex-col gap-1.5 overflow-y-auto flex-1 p-4">
                {/* Home Link */}
                {home && (
                  <Button
                    asChild
                    variant="ghost"
                    size="lg"
                    className={cn(
                      'flex items-center justify-start gap-3 text-base py-3 px-4 rounded-xl transition-all duration-200',
                      pathname === home.slug
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm font-medium'
                        : 'hover:bg-accent/70',
                    )}
                    onClick={onClose}
                  >
                    <Link href={home.slug} className="flex items-center gap-3 w-full">
                      <div
                        className={cn(
                          'p-1.5 rounded-lg',
                          pathname === home.slug ? 'bg-primary-foreground/15' : 'bg-accent/70',
                        )}
                      >
                        <FiHome size="1.2rem" strokeWidth={pathname === home.slug ? 2.5 : 2} />
                      </div>
                      <span>{home.name}</span>
                    </Link>
                  </Button>
                )}

                {/* Professional Section */}
                <div className="flex flex-col gap-1">
                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={() => setProfessionalOpen(!professionalOpen)}
                    className="flex items-center justify-between gap-3 text-base py-3 px-4 rounded-xl hover:bg-accent/70 transition-all duration-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-lg bg-accent/70">
                        <FiBriefcase size="1.2rem" className="text-primary" strokeWidth={2} />
                      </div>
                      <span>Professional</span>
                    </div>
                    <motion.div
                      animate={{ rotate: professionalOpen ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <FiChevronDown size="1.1rem" className="text-muted-foreground" />
                    </motion.div>
                  </Button>

                  <AnimatePresence initial={false}>
                    {professionalOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <div className="flex flex-col gap-1 pl-2 pt-1">
                          {professional.map((item, index) => (
                            <motion.div
                              key={item.slug}
                              initial={{ x: -10, opacity: 0 }}
                              animate={{ x: 0, opacity: 1 }}
                              transition={{ delay: index * 0.04 }}
                            >
                              <Button
                                asChild
                                variant="ghost"
                                className={cn(
                                  'flex items-center justify-start gap-3 text-sm py-2.5 px-4 rounded-lg transition-all duration-200',
                                  pathname === item.slug
                                    ? 'bg-primary/10 text-primary font-medium'
                                    : 'hover:bg-accent/50 text-muted-foreground hover:text-foreground',
                                )}
                                onClick={onClose}
                              >
                                <Link href={item.slug} className="flex items-center gap-3 w-full">
                                  <item.icon size="1.05rem" />
                                  <span>{item.name}</span>
                                </Link>
                              </Button>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Developer Section */}
                <div className="flex flex-col gap-1">
                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={() => setDeveloperOpen(!developerOpen)}
                    className="flex items-center justify-between gap-3 text-base py-3 px-4 rounded-xl hover:bg-accent/70 transition-all duration-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-lg bg-accent/70">
                        <FiCode size="1.2rem" className="text-primary" strokeWidth={2} />
                      </div>
                      <span>Developer</span>
                    </div>
                    <motion.div
                      animate={{ rotate: developerOpen ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <FiChevronDown size="1.1rem" className="text-muted-foreground" />
                    </motion.div>
                  </Button>

                  <AnimatePresence initial={false}>
                    {developerOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <div className="flex flex-col gap-1 pl-2 pt-1">
                          {developer.map((item, index) => (
                            <motion.div
                              key={item.slug}
                              initial={{ x: -10, opacity: 0 }}
                              animate={{ x: 0, opacity: 1 }}
                              transition={{ delay: index * 0.04 }}
                            >
                              <Button
                                asChild
                                variant="ghost"
                                className={cn(
                                  'flex items-center justify-start gap-3 text-sm py-2.5 px-4 rounded-lg transition-all duration-200',
                                  pathname === item.slug
                                    ? 'bg-primary/10 text-primary font-medium'
                                    : 'hover:bg-accent/50 text-muted-foreground hover:text-foreground',
                                )}
                                onClick={onClose}
                              >
                                <Link href={item.slug} className="flex items-center gap-3 w-full">
                                  <item.icon size="1.05rem" />
                                  <span>{item.name}</span>
                                </Link>
                              </Button>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Personal Section */}
                <div className="flex flex-col gap-1">
                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={() => setPersonalOpen(!personalOpen)}
                    className="flex items-center justify-between gap-3 text-base py-3 px-4 rounded-xl hover:bg-accent/70 transition-all duration-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-lg bg-accent/70">
                        <FiUser size="1.2rem" className="text-primary" strokeWidth={2} />
                      </div>
                      <span>Personal</span>
                    </div>
                    <motion.div
                      animate={{ rotate: personalOpen ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <FiChevronDown size="1.1rem" className="text-muted-foreground" />
                    </motion.div>
                  </Button>

                  <AnimatePresence initial={false}>
                    {personalOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <div className="flex flex-col gap-1 pl-2 pt-1">
                          {personal.map((item, index) => (
                            <motion.div
                              key={item.slug}
                              initial={{ x: -10, opacity: 0 }}
                              animate={{ x: 0, opacity: 1 }}
                              transition={{ delay: index * 0.04 }}
                            >
                              <Button
                                asChild
                                variant="ghost"
                                className={cn(
                                  'flex items-center justify-start gap-3 text-sm py-2.5 px-4 rounded-lg transition-all duration-200',
                                  pathname === item.slug
                                    ? 'bg-primary/10 text-primary font-medium'
                                    : 'hover:bg-accent/50 text-muted-foreground hover:text-foreground',
                                )}
                                onClick={onClose}
                              >
                                <Link href={item.slug} className="flex items-center gap-3 w-full">
                                  <item.icon size="1.05rem" />
                                  <span>{item.name}</span>
                                </Link>
                              </Button>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Legal Section */}
                <div className="flex flex-col gap-1">
                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={() => setLegalOpen(!legalOpen)}
                    className="flex items-center justify-between gap-3 text-base py-3 px-4 rounded-xl hover:bg-accent/70 transition-all duration-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-lg bg-accent/70">
                        <FaGavel size="1.2rem" className="text-primary" strokeWidth={2} />
                      </div>
                      <span>Legal</span>
                    </div>
                    <motion.div
                      animate={{ rotate: legalOpen ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <FiChevronDown size="1.1rem" className="text-muted-foreground" />
                    </motion.div>
                  </Button>

                  <AnimatePresence initial={false}>
                    {legalOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <div className="flex flex-col gap-1 pl-2 pt-1">
                          {legal.map((item, index) => (
                            <motion.div
                              key={item.slug}
                              initial={{ x: -10, opacity: 0 }}
                              animate={{ x: 0, opacity: 1 }}
                              transition={{ delay: index * 0.04 }}
                            >
                              <Button
                                asChild
                                variant="ghost"
                                className={cn(
                                  'flex items-center justify-start gap-3 text-sm py-2.5 px-4 rounded-lg transition-all duration-200',
                                  pathname === item.slug
                                    ? 'bg-primary/10 text-primary font-medium'
                                    : 'hover:bg-accent/50 text-muted-foreground hover:text-foreground',
                                )}
                                onClick={onClose}
                              >
                                <Link href={item.slug} className="flex items-center gap-3 w-full">
                                  <item.icon size="1.05rem" />
                                  <span>{item.name}</span>
                                </Link>
                              </Button>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Command Menu */}
                <div className="mt-2 pt-2 border-t border-border/40">
                  <Button
                    variant="ghost"
                    size="lg"
                    className="flex items-center justify-start gap-3 text-base py-3 px-4 rounded-xl hover:bg-accent/70 transition-all duration-200"
                    onClick={() => {
                      query.toggle();
                      onClose();
                    }}
                    aria-label="Open command menu"
                  >
                    <div className="p-1.5 rounded-lg bg-accent/70">
                      <FiCommand size="1.2rem" className="text-primary" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span>Command Menu</span>
                      <span className="text-xs text-muted-foreground">Quick navigation</span>
                    </div>
                  </Button>
                </div>
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  },
);
MobileMenuOverlay.displayName = 'MobileMenuOverlay';
export default MobileMenuOverlay;
