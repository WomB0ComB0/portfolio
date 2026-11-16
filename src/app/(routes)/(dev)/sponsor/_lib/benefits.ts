/**
 * Copyright 2026 Mike Odnis
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

/**
 * @file The old page's four benefits, word for word apart from sentence case. Shown only with
 * "sponsor-benefits: keep": "Early access" promises early features, tools and exclusive content,
 * which the owner has not confirmed, so the route drops the list by default.
 */

export interface SponsorBenefit {
  readonly title: string;
  readonly description: string;
}

export const SPONSOR_BENEFITS: readonly SponsorBenefit[] = [
  {
    title: 'Support open source',
    description: 'Help me dedicate more time to building and maintaining open-source projects.',
  },
  {
    title: 'Fuel development',
    description: 'Cover hosting costs, tools, and resources for better projects.',
  },
  {
    title: 'Early access',
    description: 'Get early access to new features, tools, and exclusive content.',
  },
  {
    title: 'Join the community',
    description: 'Become part of a community of supporters and contributors.',
  },
];
