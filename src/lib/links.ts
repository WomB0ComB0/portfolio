import type { IconType } from 'react-icons';
import { FaBitbucket, FaFreeCodeCamp, FaGithubAlt } from 'react-icons/fa';
import {
  SiBuymeacoffee,
  SiCodepen,
  SiDevdotto,
  SiDiscord,
  SiDribbble,
  SiFigma,
  SiGithub,
  SiHackerrank,
  SiHashnode,
  SiInstagram,
  SiLeetcode,
  SiLinkedin,
  SiMedium,
  SiMicrosoft,
  SiSpotify,
  SiX,
} from 'react-icons/si';
import { SiSololearn } from 'react-icons/si';
import { SlGraph } from 'react-icons/sl';

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
    url: `https://discord.com/users/${process.env.DISCORD_ID}`,
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
    url: 'https://open.spotify.com/user/airwolf635?si=14affc04df504bb7',
    value: '@Mike Odnis',
    icon: SiSpotify,
  },
  {
    name: 'Dev.to',
    url: 'https://dev.to/womb0comb0',
    value: '@womb0comb0',
    icon: SiDevdotto,
  },
  {
    name: 'LinkedIn',
    url: 'https://linkedin.com/in/mikeodnis',
    value: '@mikeodnis',
    icon: SiLinkedin,
  },
  {
    name: 'CodersRank',
    url: 'https://www.hackerrank.com/profile/airwolf635',
    value: '@airwolf635',
    icon: SlGraph,
  },
  {
    name: 'Codepen',
    url: 'https://codepen.io/womb0comb0',
    value: '@womb0comb0',
    icon: SiCodepen,
  },
  {
    name: 'Leetcode',
    url: 'https://leetcode.com/WomB0ComB0/',
    value: '@WomB0ComB0',
    icon: SiLeetcode,
  },
  {
    name: 'HackerRank',
    url: 'https://www.hackerrank.com/airwolf635',
    value: '@airwolf635',
    icon: SiHackerrank,
  },
  {
    name: 'Microsoft Learn',
    url: 'https://learn.microsoft.com/en-us/users/mikeodnis/',
    value: '@mikeodnis',
    icon: SiMicrosoft,
  },
  {
    name: 'SoloLearn',
    url: 'https://www.sololearn.com/en/profile/24459722',
    value: '@24459722',
    icon: SiSololearn,
  },
  {
    name: 'FreeCodeCamp',
    url: 'https://www.freecodecamp.org/WomB0ComB0',
    value: '@WomB0ComB0',
    icon: FaFreeCodeCamp,
  },
  {
    name: 'Bitbucket',
    url: 'https://bitbucket.org/womb0comb0',
    value: '@womb0comb0',
    icon: FaBitbucket,
  },
  {
    name: 'Gists',
    url: 'https://gist.github.com/WomB0ComB0',
    value: '@WomB0ComB0',
    icon: FaGithubAlt,
  },
  {
    name: 'Dribbble',
    url: 'https://dribbble.com/WomB0ComB0',
    value: '@WomB0ComB0',
    icon: SiDribbble,
  },
  {
    name: 'Figma',
    url: 'https://figma.com/@WomB0COmB0',
    value: '@WomB0COmB0',
    icon: SiFigma,
  },
  {
    name: 'Medium',
    url: 'https://medium.com/@mikeodnis3242004',
    value: '@mikeodnis3242004',
    icon: SiMedium,
  },
  {
    name: 'Hashnode',
    url: 'https://blog.mikeodnis.com',
    value: '@mikeodnis',
    icon: SiHashnode,
  },
];
