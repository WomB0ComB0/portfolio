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
  FiBookOpen,
  FiFileText,
  FiHeadphones,
  FiHome,
  FiMapPin,
  FiPaperclip,
  FiUser,
  FiZap,
} from 'react-icons/fi';

export const NavbarItems = [
  {
    name: 'Home',
    slug: '/',
    icon: FiHome,
  },
  {
    name: 'About',
    slug: '/about',
    icon: FiUser,
  },
  {
    name: 'Resume',
    slug: '/resume',
    icon: FiFileText,
  },
  {
    name: 'Places',
    slug: '/places',
    icon: FiMapPin,
  },
  {
    name: 'Links',
    slug: '/links',
    icon: FiPaperclip,
  },
  {
    name: 'Guestbook',
    slug: '/guestbook',
    icon: FiBookOpen,
  },
  {
    name: 'Spotify',
    slug: '/spotify',
    icon: FiHeadphones,
  },
  {
    name: 'Dashboard',
    slug: '/dashboard',
    icon: FiZap,
  },
];
