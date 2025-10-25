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
 * @interface StatCard
 * @version 1.0.0
 * @readonly
 * @description
 * Defines the structure and required fields for displaying a statistic card within the DevStats component.
 * Each card presents a specific metric, optionally linking to a relevant resource and referencing the backend query key.
 * @property {string} title - The display title of the statistic.
 * @property {string} link - The associated URL for additional details or references, may be empty.
 * @property {string} query - The backend or local statistic identifier key.
 * @author Mike Odnis
 * @see https://github.com/WomB0ComB0/portfolio
 */
export interface StatCard {
  title: string;
  link: string;
  query: string;
}
