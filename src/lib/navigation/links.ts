import type { IconType } from 'react-icons';
import { FaBitbucket, FaFreeCodeCamp, FaGithubAlt, FaMicrosoft } from 'react-icons/fa';
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
  SiSololearn,
  SiSpotify,
  SiX,
} from 'react-icons/si';
import { SlGraph } from 'react-icons/sl';
import { config } from '@/config';

/**
 * @interface Link
 * @description
 * Represents a navigable external resource or social profile.
 * Used in the navigation system to unify social and project links.
 *
 * @property {string} name - The display name of the resource.
 * @property {string} url - The external URL pointing to the resource or profile.
 * @property {string} value - The user handle, id, or unique value associated with the link.
 * @property {IconType} icon - The icon representing this resource (from react-icons).
 * @author Mike Odnis
 * @version 1.0.0
 * @public
 * @see https://github.com/WomB0ComB0/portfolio
 */
export type Link = {
  name: string;
  url: string;
  value: string;
  icon: IconType;
};

/**
 * @typedef {Link[]} Links
 * @description
 * An array of {@link Link} entries, each representing a social profile, project, or developer platform.
 * Used by UI navigation components to dynamically render social and external links.
 * @author Mike Odnis
 * @version 1.0.0
 * @public
 * @see https://github.com/WomB0ComB0/portfolio
 */
export type Links = Link[];

/**
 * @constant
 * @readonly
 * @public
 * @type {Links}
 * @description
 * List of all external navigation and social links used throughout the application.
 * Each object describes a social or development platform presence.
 *
 * @author Mike Odnis
 * @version 1.0.0
 * @web
 * @see https://github.com/WomB0ComB0/portfolio
 * @example
 * // Mapping all platforms' urls to display in a footer:
 * links.map(l => <a href={l.url}>{l.name}</a>)
 */
export const links: Links = [
  {
    name: 'Discord',
    url: `https://discord.com/users/${config.discord.id}`,
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
    url: 'https://www.buymeacoffee.com/mikeodnis3a',
    value: '@mikeodnis3a',
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
    url: 'https://learn.microsoft.com/en-us/users/mikeodnis-1859/',
    value: '@mikeodnis-1859',
    icon: FaMicrosoft,
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
    url: 'https://bitbucket.org/womb0comb0/workspace/overview/',
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
