type MetadataProps = {
  noIndex?: boolean;
  image?: string;
  icons?: string;
  title?: string;
  description?: string;
};

type ContactDetail = {
  type: string;
  icon: JSX.Element;
  text: string;
  link?: string;
};

type Inputs = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

type ProjectProps = {
  name: string;
  description: string[];
  techStack: string[];
  link?: string | any;
  image?: string | any;
  imageAlt: string;
  github?: string;
  devpost?: string;
  figma?: string;
};

interface Skills {
  image?: string | any;
  borderColor?: string;
  name: string;
  certificate?: string;
}

interface Buttons {
  name: string;
}

type ExperienceProps = {
  logo?: string | any;
  company: string;
  title: string;
  type: string;
  location: string;
  startDate: string;
  endDate: string;
  description: string[];
};

type CursorProps = {
  color: string;
  x: number;
  y: number;
};
