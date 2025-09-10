export interface CertificationItem {
  id: string;
  title: string;
  category: string;
  acquisitionDate: string;
  expirationDate?: string; // Optional
  imageUrl?: string; // Optional, for a logo perhaps
}

export interface ExperienceItem {
  id: string;
  companyTitle: string;
  companyImage?: string; // Optional
  employmentPeriod: string; // e.g., "Jan 2022 - Present"
  jobTitle: string;
  jobDescriptionShort: string; // For the overview on the main page
  jobDescriptionLong: string; // For the detailed view on experience/[id]
  skills: string[];
  media?: Array<{ type: 'image' | 'link'; url: string; title?: string }>; // Optional
}
