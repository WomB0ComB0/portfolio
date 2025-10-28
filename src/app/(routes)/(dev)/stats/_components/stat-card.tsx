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

import { MagicCard } from '@/components';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';

interface StatCardProps {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
  delay?: number;
}

export const StatCard = ({
  icon,
  title,
  children,
  className,
  footer,
  delay = 0,
}: StatCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="h-full"
    >
      <MagicCard
        className={cn(
          'flex flex-col overflow-hidden h-full backdrop-blur-sm border-border/50',
          className,
        )}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-primary-background/80">{title}</CardTitle>
          <div className="text-primary-background/80">{icon}</div>
        </CardHeader>
        <CardContent className="grow">{children}</CardContent>
        {footer && <div className="p-6 pt-0">{footer}</div>}
      </MagicCard>
    </motion.div>
  );
};
