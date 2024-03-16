import {
  SiDiscord,
  SiGithub,
  SiInstagram,
  SiTwitter,
  SiBuymeacoffee,
  SiKitsu,
  SiNpm,
  SiLastdotfm,
  SiSpotify,
  SiReddit,
  SiDevdotto,
  SiHashnode,
} from "react-icons/si";
import { IconType } from "react-icons";

export type Link = {
  name: string;
  url: string;
  value: string;
  icon: IconType;
};

export type Links = Link[];

export const links: Links = [
  {
    name: "Discord",
    url: "https://discord.com/users/${}",
    value: "mikeodnis",
    icon: SiDiscord,
  },
  {
    name: "GitHub",
    url: "https://github.com/WomB0ComB0",
    value: "@WomB0ComB0",
    icon: SiGithub,
  },
  {
    name: "Instagram",
    url: "https://instagram.com/_xmike__",
    value: "@_xmike__",
    icon: SiInstagram,
  },
  {
    name: "Twitter",
    url: "https://twitter.com/Odnismike",
    value: "@OdnisMike",
    icon: SiTwitter,
  },
  {
    name: "Buy me a coffee",
    url: "https://www.buymeacoffee.com/womb0comb0 ",
    value: "@womb0comb0",
    icon: SiBuymeacoffee,
  },
  // {
  //   name: "Kitsu",
  //   url: "https://kitsu.io/users/",
  //   value: "@",
  //   icon: SiKitsu,
  // },
  {
    name: "Spotify",
    url: "https://open.spotify.com/user/${}",
    value: "@",
    icon: SiSpotify,
  },
  {
    name: "Dev.to",
    url: "https://dev.to/",
    value: "@",
    icon: SiDevdotto,
  },
  {
    name: "Hashnode",
    url: "https://blog.mikeodnis.com",
    value: "@mikeodnis",
    icon: SiHashnode,
  },
];
