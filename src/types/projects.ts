export interface ProjectItem {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  projectUrl?: string;
  repoUrl?: string;
  tags: string[];
  category: string;
}
