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

import type { useKBar } from 'kbar';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import type React from 'react';
import { memo, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiBriefcase, FiChevronDown, FiCode, FiCommand, FiHome, FiX } from 'react-icons/fi';
import { Button } from '@/components/ui/button';
import { groupNavItems } from './nav';

interface MobileMenuOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  pathname: string;
  query: ReturnType<typeof useKBar>['query'];
  triggerRef?: React.RefObject<HTMLButtonElement>;
}

export const MobileMenuOverlay: React.FC<MobileMenuOverlayProps> = memo(
  ({ isOpen, onClose, pathname, query, triggerRef }) => {
    const [professionalOpen, setProfessionalOpen] = useState(false);
    const [developerOpen, setDeveloperOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const { professional, developer, home } = groupNavItems();

    useEffect(() => {
      setMounted(true);
    }, []);

    useEffect(() => {
      if (isOpen) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
        setProfessionalOpen(false);
        setDeveloperOpen(false);
      }
      return () => {
        document.body.style.overflow = '';
      };
    }, [isOpen]);

    // Manage focus when the dialog opens/closes and trap focus while open
    useEffect(() => {
      if (!isOpen) return;

      const dialog = document.getElementById('mobile-menu-dialog');
      const focusableSelector = [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
      ].join(',');

      const focusFirst = () => {
        if (!dialog) return;
        const first = dialog.querySelector<HTMLElement>(focusableSelector);
        first?.focus();
      };

      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
          return;
        }

        if (e.key === 'Tab') {
          if (!dialog) return;
          const nodes = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)).filter(
            Boolean,
          );
          if (nodes.length === 0) return;
          const first = nodes.at(0);
          const last = nodes.at(-1);
          if (!first || !last) return;
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      };

      setTimeout(focusFirst, 0);
      globalThis.window.addEventListener('keydown', onKeyDown);

      return () => {
        globalThis.window.removeEventListener('keydown', onKeyDown);
        if (triggerRef && 'current' in triggerRef && triggerRef.current) {
          triggerRef.current.focus();
        }
      };
    }, [isOpen, onClose, triggerRef]);

    useEffect(() => {
      const handleResize = () => {
        if (window.innerWidth >= 768 && isOpen) {
          onClose();
        }
      };

      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, [isOpen, onClose]);

    if (!mounted || !isOpen) return null;

    const content = (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-9998 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.25, type: 'spring' as const, damping: 25, stiffness: 300 }}
          className="fixed inset-x-0 bottom-0 z-9999 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-card shadow-2xl"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-menu-title"
          id="mobile-menu-dialog"
        >
          <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-border bg-linear-to-b from-card/80 to-card/60 backdrop-blur-md">
            <div className="flex items-center gap-3">
              {home && (
                <Link href={home.slug} className="flex items-center gap-3">
                  <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-linear-to-tr from-primary/20 to-primary/8 ring-1 ring-primary/8">
                    <FiHome size="1rem" className="text-foreground" />
                  </div>
                  <span id="mobile-menu-title" className="font-semibold text-lg text-foreground">
                    {home.name}
                  </span>
                </Link>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground hidden sm:inline">Menu</span>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-full h-9 w-9"
                onClick={onClose}
                aria-label="Close menu"
              >
                <FiX size="1.25rem" />
              </Button>
            </div>
          </div>

          <nav className="p-4 pb-8 space-y-1.5">
            {home && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 }}
              >
                <Button
                  asChild
                  variant="ghost"
                  className={`w-full flex items-center justify-start gap-3 text-base py-3 px-4 rounded-lg transition-all ${
                    pathname === home.slug ? 'bg-primary/95 text-foreground' : 'hover:bg-accent'
                  }`}
                  onClick={onClose}
                >
                  <Link href={home.slug} className="flex items-center gap-3 w-full">
                    <div
                      className={`w-9 h-9 flex items-center justify-center rounded-md ${
                        pathname === home.slug ? 'bg-primary-foreground/20' : 'bg-primary/8'
                      }`}
                    >
                      <FiHome size="1.05rem" />
                    </div>
                    <span className="font-medium text-foreground">{home.name}</span>
                  </Link>
                </Button>
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Button
                onClick={() => {
                  setProfessionalOpen(!professionalOpen);
                  if (!professionalOpen) setDeveloperOpen(false);
                }}
                variant="ghost"
                className="w-full flex items-center justify-between gap-3 text-base py-3 px-4 rounded-lg hover:bg-accent transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 flex items-center justify-center rounded-md bg-primary/8">
                    <FiBriefcase size="1.05rem" className="text-foreground" />
                  </div>
                  <span className="font-medium text-foreground">Professional</span>
                </div>
                <motion.div
                  animate={{ rotate: professionalOpen ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-muted-foreground"
                >
                  <FiChevronDown size="1rem" />
                </motion.div>
              </Button>

              <AnimatePresence>
                {professionalOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden pl-3 mt-1"
                  >
                    {professional.map((item, index) => (
                      <motion.div
                        key={item.slug}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Button
                          asChild
                          variant="ghost"
                          className={`w-full flex items-center justify-start gap-3 text-sm py-3 px-4 rounded-md mb-1 ${
                            pathname === item.slug
                              ? 'bg-primary/10 font-medium text-foreground'
                              : 'hover:bg-accent/40 text-foreground'
                          }`}
                          onClick={onClose}
                        >
                          <Link href={item.slug} className="flex items-center gap-3 w-full">
                            <item.icon size="1rem" />
                            <span className={`text-foreground`}>{item.name}</span>
                          </Link>
                        </Button>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Button
                onClick={() => {
                  setDeveloperOpen(!developerOpen);
                  if (!developerOpen) setProfessionalOpen(false);
                }}
                variant="ghost"
                className="w-full flex items-center justify-between gap-3 text-base py-3 px-4 rounded-lg hover:bg-accent transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 flex items-center justify-center rounded-md bg-primary/8">
                    <FiCode size="1.05rem" className="text-foreground" />
                  </div>
                  <span className="font-medium text-foreground">Developer</span>
                </div>
                <motion.div
                  animate={{ rotate: developerOpen ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-muted-foreground"
                >
                  <FiChevronDown size="1rem" />
                </motion.div>
              </Button>

              <AnimatePresence>
                {developerOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden pl-3 mt-1"
                  >
                    {developer.map((item, index) => (
                      <motion.div
                        key={item.slug}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Button
                          asChild
                          variant="ghost"
                          className={`w-full flex items-center justify-start gap-3 text-sm py-3 px-4 rounded-md mb-1 ${
                            pathname === item.slug
                              ? 'bg-primary/10 font-medium text-foreground'
                              : 'hover:bg-accent/40 text-foreground'
                          }`}
                          onClick={onClose}
                        >
                          <Link href={item.slug} className="flex items-center gap-3 w-full">
                            <item.icon size="1rem" />
                            <span className={`text-foreground`}>{item.name}</span>
                          </Link>
                        </Button>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            <div className="py-2">
              <div className="border-t border-border/60" />
            </div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Button
                variant="ghost"
                className="w-full flex items-center justify-start gap-3 text-base py-3 px-4 rounded-lg hover:bg-accent transition-all"
                onClick={() => {
                  query.toggle();
                  onClose();
                }}
                aria-label="Open command menu"
              >
                <div className="w-9 h-9 flex items-center justify-center rounded-md bg-primary/8">
                  <FiCommand size="1.05rem" className="text-foreground" />
                </div>
                <span className="font-medium text-foreground">Command Menu</span>
              </Button>
            </motion.div>
          </nav>
        </motion.div>
      </AnimatePresence>
    );

    return createPortal(content, document.body);
  },
);
MobileMenuOverlay.displayName = 'MobileMenuOverlay';
export default MobileMenuOverlay;
