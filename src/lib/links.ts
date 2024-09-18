import type { IconType } from 'react-icons';
import {
  SiBuymeacoffee,
  SiDevdotto,
  SiDiscord,
  SiGithub,
  SiHashnode,
  SiInstagram,
  SiSpotify,
  SiX,
} from 'react-icons/si';

export type Link = {
  name: string;
  url: string;
  value: string;
  icon: IconType;
};

export type Links = Link[];

export const links: Links = [
  {
    name: 'Discord',
    url: 'https://discord.com/users/${}',
    value: 'mikeodnis',
    icon: SiDiscord,
  },
  {
    name: 'GitHub',
    url: 'https://github.com/WomB0ComB0',
    value: '@WomB0ComB0',
    icon: SiGithub,
  },
  {
    name: 'Instagram',
    url: 'https://instagram.com/_xmike__',
    value: '@_xmike__',
    icon: SiInstagram,
  },
  {
    name: 'Twitter',
    url: 'https://twitter.com/Odnismike',
    value: '@OdnisMike',
    icon: SiX,
  },
  {
    name: 'Buy me a coffee',
    url: 'https://www.buymeacoffee.com/womb0comb0 ',
    value: '@womb0comb0',
    icon: SiBuymeacoffee,
  },
  {
    name: 'Spotify',
    url: 'https://open.spotify.com/user/${}',
    value: '@',
    icon: SiSpotify,
  },
  {
    name: 'Dev.to',
    url: 'https://dev.to/',
    value: '@',
    icon: SiDevdotto,
  },
  {
    name: 'Hashnode',
    url: 'https://blog.mikeodnis.com',
    value: '@mikeodnis',
    icon: SiHashnode,
  },
];
