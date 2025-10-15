// Live blocks cursors
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
