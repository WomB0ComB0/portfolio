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

import {
  FiAward,
  FiBarChart,
  FiBookOpen,
  FiBriefcase,
  FiClipboard,
  FiFileText,
  FiHeadphones,
  FiHeart,
  FiHome,
  FiMapPin,
} from 'react-icons/fi';
import { SiHashnode } from 'react-icons/si';

/**
 * @typedef {Object} NavigationAction
 * @property {string} id - Unique identifier for the action.
 * @property {string} name - Human-readable name for the navigation action.
 * @property {readonly string[]} shortcut - Keyboard shortcuts for triggering the action.
 * @property {string} keywords - Searchable keywords related to the action.
 * @property {() => void} perform - Function to perform the navigation action, which navigates the browser to a new path.
 * @property {string} section - The section this navigation action belongs to.
 * @property {JSX.Element} icon - JSX element icon representing the navigation action.
 * @description
 * Represents a single navigation command/action used in the command palette or quick navigation UI.
 * @author Mike Odnis
 * @version 1.0.0
 * @see https://github.com/WomB0ComB0/portfolio
 * @public
 */

/**
 * @constant
 * @readonly
 * @type {readonly NavigationAction[]}
 * @description
 * List of navigation and command actions available throughout the application. Used to power navigation shortcuts and palette UI.
 * Each object defines route, shortcut, identifying keywords, perform action, display section, and icon.
 * @author Mike Odnis
 * @version 1.0.0
 * @see https://github.com/WomB0ComB0/portfolio
 * @web
 * @public
 * @example
 * // Render available actions in a command bar:
 * actions.forEach(action => <button onClick={action.perform}>{action.name}</button>)
 */
export const actions = [
  {
    id: 'home',
    name: 'Home',
    shortcut: ['h'],
    keywords: 'home',
    /**
     * Navigates to the home page by setting pathname to '/'.
     * @function
     * @public
     * @returns {void}
     * @web
     * @throws {Error} May throw if access to window or navigation fails unexpectedly.
     * @example
     * actions.find(a => a.id === 'home')?.perform()
     */
    perform: () => {
      window.location.pathname = '/';
    },
    section: 'Navigation',
    icon: FiHome({ size: '1rem' }),
  },
  {
    id: 'projects',
    name: 'Projects',
    shortcut: ['p'],
    keywords: 'projects portfolio work code',
    /**
     * Navigates to the projects page ('/projects').
     * @function
     * @public
     * @returns {void}
     * @web
     * @throws {Error} May throw if window navigation fails.
     */
    perform: () => {
      window.location.pathname = '/projects';
    },
    section: 'Navigation',
    icon: FiBriefcase({ size: '1rem' }),
  },
  {
    id: 'experience',
    name: 'Experience',
    shortcut: ['x'],
    keywords: 'experience work history jobs',
    /**
     * Navigates to the experience page ('/experience').
     * @function
     * @public
     * @returns {void}
     * @web
     * @throws {Error} May throw if window navigation fails.
     */
    perform: () => {
      window.location.pathname = '/experience';
    },
    section: 'Navigation',
    icon: FiClipboard({ size: '1rem' }),
  },
  {
    id: 'certifications',
    name: 'Certifications',
    shortcut: ['c'],
    keywords: 'certifications credentials certificates',
    /**
     * Navigates to the certifications page ('/certifications').
     * @function
     * @public
     * @returns {void}
     * @web
     * @throws {Error}
     */
    perform: () => {
      window.location.pathname = '/certifications';
    },
    section: 'Navigation',
    icon: FiAward({ size: '1rem' }),
  },
  {
    id: 'resume',
    name: 'Resume',
    shortcut: ['r'],
    keywords: 'resume cv',
    /**
     * Navigates to the resume page ('/resume').
     * @function
     * @public
     * @returns {void}
     * @web
     */
    perform: () => {
      window.location.pathname = '/resume';
    },
    section: 'Navigation',
    icon: FiFileText({ size: '1rem' }),
  },
  {
    id: 'blog',
    name: 'Blog',
    shortcut: ['b'],
    keywords: 'blog writing articles posts',
    /**
     * Navigates to the blog page ('/blog').
     * @function
     * @public
     * @returns {void}
     * @web
     */
    perform: () => {
      window.location.pathname = '/blog';
    },
    section: 'Navigation',
    icon: SiHashnode({ size: '1rem' }),
  },
  {
    id: 'places',
    name: 'Places',
    shortcut: ['l'],
    keywords: 'places locations map travel',
    /**
     * Navigates to the places page ('/places').
     * @function
     * @public
     * @returns {void}
     * @web
     */
    perform: () => {
      window.location.pathname = '/places';
    },
    section: 'Navigation',
    icon: FiMapPin({ size: '1rem' }),
  },
  {
    id: 'spotify',
    name: 'Spotify',
    shortcut: ['s'],
    keywords: 'spotify music stats listening',
    /**
     * Navigates to the Spotify stats page ('/spotify').
     * @function
     * @public
     * @returns {void}
     * @web
     */
    perform: () => {
      window.location.pathname = '/spotify';
    },
    section: 'Navigation',
    icon: FiHeadphones({ size: '1rem' }),
  },
  {
    id: 'guestbook',
    name: 'Guestbook',
    shortcut: ['g'],
    keywords: 'guestbook messages comments',
    /**s
     * Navigates to the guestbook page ('/guestbook').
     * @function
     * @public
     * @returns {void}
     * @web
     */
    perform: () => {
      window.location.pathname = '/guestbook';
    },
    section: 'Navigation',
    icon: FiBookOpen({ size: '1rem' }),
  },
  {
    id: 'stats',
    name: 'Stats',
    shortcut: ['d'],
    keywords: 'stats analytics',
    /**
     * Navigates to the stats/analytics page ('/stats').
     * @function
     * @public
     * @returns {void}
     * @web
     */
    perform: () => {
      window.location.pathname = '/stats';
    },
    section: 'Navigation',
    icon: FiBarChart({ size: '1rem' }),
  },
  {
    id: 'sponsor',
    name: 'Sponsor',
    shortcut: ['$'],
    keywords: 'sponsor support donate contribute funding',
    /**
     * Navigates to the sponsor/donate page ('/sponsor').
     * @function
     * @public
     * @returns {void}
     * @web
     */
    perform: () => {
      window.location.pathname = '/sponsor';
    },
    section: 'Navigation',
    icon: FiHeart({ size: '1rem' }),
  },
];
