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

/**
 * @interface Sponsor
 * @description
 * Represents an individual GitHub sponsor with associated metadata, including account, tier, and sponsorship details.
 * Returned as elements of {@link GitHubSponsorsData.sponsors}.
 * @property {string} login - Sponsor's GitHub login/username.
 * @property {string | null} name - Display name of the sponsor or null.
 * @property {string} avatarUrl - URL to the sponsor's avatar image.
 * @property {string} url - Profile URL of the sponsor on GitHub.
 * @property {{name: string; monthlyPriceInDollars: number} | null} tier - Sponsorship tier info or null if not available.
 * @property {string} createdAt - ISO timestamp when sponsorship began.
 * @property {boolean} isActive - Whether the sponsor's support is currently active.
 * @property {'User' | 'Organization'} type - Account type; either 'User' or 'Organization'.
 * @public
 * @readonly
 * @author Mike Odnis
 * @version 1.0.0
 * @see https://github.com/WomB0ComB0/portfolio
 */
export interface Sponsor {
  login: string;
  name: string | null;
  avatarUrl: string;
  url: string;
  tier: {
    name: string;
    monthlyPriceInDollars: number;
  } | null;
  createdAt: string;
  isActive: boolean;
  type: 'User' | 'Organization';
}

/**
 * @interface GitHubSponsorsData
 * @description
 * Structure of the response containing sponsors and related metadata, returned by GitHub Sponsors API integrations.
 * @property {Sponsor[]} sponsors - Array of {@link Sponsor} objects.
 * @property {number} totalCount - Total number of sponsors (active and inactive).
 * @property {number} totalMonthlyIncome - Aggregated monthly income from all sponsors in US dollars.
 * @public
 * @readonly
 * @author Mike Odnis
 * @version 1.0.0
 */
export interface GitHubSponsorsData {
  sponsors: Sponsor[];
  totalCount: number;
  totalMonthlyIncome: number;
}
