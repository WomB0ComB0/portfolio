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

import dynamic from 'next/dynamic';
import { constructMetadata } from '@/utils';

/**
 * Dynamically imported React component for displaying sponsor information.
 * This component is loaded client-side but also rendered server-side (SSR) to ensure content is available on initial page load.
 *
 * @web
 * @author Mike Odnis
 * @version 1.0.0
 * @see {@link ./_interface/sponsor}
 */
const Sponsor = dynamic(() => import('./_interface/sponsor').then((mod) => mod.Sponsor), {
  ssr: true,
});

/**
 * Metadata configuration for the Sponsor page.
 * This object is used by Next.js to provide SEO information, define the browser title,
 * and set the page description for search engines and social media shares.
 *
 * @type {import("next").Metadata}
 * @readonly
 * @web
 * @author Mike Odnis
 * @version 1.0.0
 * @see {@link https://nextjs.org/docs/app/building-your-application/optimizing/metadata}
 */
export const metadata = constructMetadata({
  title: 'Sponsor',
  description:
    'Support my work through sponsorship. See my current sponsors and ways to contribute.',
});

/**
 * The main page component for displaying sponsor information.
 * This functional component renders the dynamically loaded `Sponsor` component,
 * which showcases current sponsors and outlines ways to contribute to the project.
 *
 * @public
 * @returns {JSX.Element} A React JSX element representing the Sponsor page.
 * @web
 * @author Mike Odnis
 * @version 1.0.0
 * @see {@link Sponsor} for the actual sponsor display logic.
 */
const SponsorPage = () => {
  return <Sponsor />;
};

export default SponsorPage;
