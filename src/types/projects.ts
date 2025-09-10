export interface ProjectItem {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  projectUrl?: string; // Live link
  repoUrl?: string; // Code repository
  tags: string[]; // For filtering, e.g., ["React", "Node.js", "AI"]
  category: string; // e.g., "Web Development", "Machine Learning", "Game Dev"
}
