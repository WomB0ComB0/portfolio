/**
 * @readonly
 * @public
 * @const
 * @type {readonly string[]}
 * @description
 * Color palette used for live block cursors in collaborative UI elements.
 * Each color hex string distinctly represents a different user/session.
 *
 * @author Mike Odnis
 * @web
 * @see https://github.com/WomB0ComB0/portfolio
 * @version 1.0.0
 * @example
 *   const color = COLORS[userIndex % COLORS.length];
 */
export const COLORS = [
  '#6941C6',
  '#6839C1',
  '#6830BB',
  '#6728B6',
  '#6620B1',
  '#6518AC',
  '#650FA6',
  '#6407A1',
];

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
 * @readonly
 * @public
 * @const
 * @type {Array<{
 *   name: string,
 *   slug: string,
 *   icon: React.ComponentType<any>
 * }>}
 * @description
 * List of navbar items for primary application navigation.
 * Each item consists of a display name, a route slug, and an associated icon component.
 * Designed for portfolio navigation UI in the web frontend.
 *
 * @author Mike Odnis
 * @web
 * @see https://github.com/WomB0ComB0/portfolio
 * @version 1.0.0
 * @example
 *   NavbarItems.map(item => <Link href={item.slug}><item.icon />{item.name}</Link>)
 */
export const NavbarItems = [
  {
    name: 'Home',
    slug: '/',
    icon: FiHome,
  },
  {
    name: 'Projects',
    slug: '/projects',
    icon: FiBriefcase,
  },
  {
    name: 'Experience',
    slug: '/experience',
    icon: FiClipboard,
  },
  {
    name: 'Certifications',
    slug: '/certifications',
    icon: FiAward,
  },
  {
    name: 'Resume',
    slug: '/resume',
    icon: FiFileText,
  },
  {
    name: 'Blog',
    slug: '/blog',
    icon: SiHashnode,
  },
  {
    name: 'Places',
    slug: '/places',
    icon: FiMapPin,
  },
  {
    name: 'Spotify',
    slug: '/spotify',
    icon: FiHeadphones,
  },
  {
    name: 'Guestbook',
    slug: '/guestbook',
    icon: FiBookOpen,
  },
  {
    name: 'Stats',
    slug: '/stats',
    icon: FiBarChart,
  },
  {
    name: 'Sponsor',
    slug: '/sponsor',
    icon: FiHeart,
  },
];
