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
 * Props interface for the LicenseCard component.
 *
 * Represents the properties required to render a license information card.
 *
 * @interface
 * @readonly
 * @author Mike Odnis
 * @see [Lucide Icon Components](https://lucide.dev/)
 * @see https://github.com/WomB0ComB0/portfolio
 * @version 1.0.0
 */
export interface LicenseCardProps {
  /** The heading displayed on the card. */
  readonly title: string;
  /** The descriptive text about what is licensed. */
  readonly description: string;
  /** The official name of the license. */
  readonly licenseName: string;
  /** The URL to the license text/details. */
  readonly licenseUrl: string;
  /** An icon representing the content type. */
  readonly icon: React.ReactNode;
}
