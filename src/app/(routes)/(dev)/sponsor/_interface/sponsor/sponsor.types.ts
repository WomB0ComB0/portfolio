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

import type { ComponentType } from 'react';

import type { GitHubSponsorsData, Sponsor } from '@/lib/api-integrations/github-sponsors';

export type { GitHubSponsorsData, Sponsor };

/** An icon component (lucide or react-icons) that takes a class name. */
export type SponsorIcon = ComponentType<{ className?: string }>;

export interface SponsorPlatform {
  name: string;
  username: string;
  url: string;
  icon: SponsorIcon;
  /** Tailwind gradient stops for the icon tile, e.g. 'from-purple-500 to-pink-500'. */
  color: string;
  description: string;
}

export interface BenefitItem {
  icon: SponsorIcon;
  title: string;
  description: string;
}

export interface SponsorListsProps {
  /**
   * What the sponsors block loaded from GitHub Sponsors, or null when that call failed or missed
   * its deadline. On null only the sponsors block shows an error; the rest of the page is static
   * and never waits on GitHub.
   */
  sponsors: GitHubSponsorsData | null;
}

/** The listable sponsors, split by whether their sponsorship is active. */
export interface SponsorGroups {
  current: readonly Sponsor[];
  past: readonly Sponsor[];
}
