/**
 * Copyright 2025 Mike Odnis
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { SanityImageSource } from '@sanity/image-url/lib/types/types';
// Re-export for convenience
export type { SanityImageSource };

/**
 * Base Sanity document fields
 */
export interface SanityDocument {
  _id: string;
  _type: string;
  _createdAt: string;
  _updatedAt: string;
  _rev: string;
}

/**
 * Sanity image asset
 */
export interface SanityImage {
  _type: 'image';
  asset: {
    _ref: string;
    _type: 'reference';
  };
  alt?: string;
  hotspot?: {
    x: number;
    y: number;
    height: number;
    width: number;
  };
  crop?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

/**
 * Sanity slug
 */
export interface SanitySlug {
  _type: 'slug';
  current: string;
}

/**
 * Experience document from Sanity
 */
export interface Experience extends SanityDocument {
  _type: 'experience';
  company: string;
  position: string;
  location: string;
  startDate: string;
  endDate?: string;
  current: boolean;
  description: string;
  responsibilities: string[];
  technologies: string[];
  logo?: SanityImage;
  companyUrl?: string;
  order: number;
}

/**
 * Project document from Sanity
 */
export interface Project extends SanityDocument {
  _type: 'project';
  title: string;
  slug: SanitySlug;
  description: string;
  longDescription?: string;
  image: SanityImage;
  images?: SanityImage[];
  technologies: string[];
  githubUrl?: string;
  liveUrl?: string;
  featured: boolean;
  category: 'web' | 'mobile' | 'design' | 'other';
  startDate: string;
  endDate?: string;
  order: number;
  status: 'completed' | 'in-progress' | 'archived';
}

/**
 * Certification document from Sanity
 */
export interface Certification extends SanityDocument {
  _type: 'certification';
  name: string;
  issuer: string;
  issueDate: string;
  expiryDate?: string;
  credentialId?: string;
  credentialUrl?: string;
  logo?: SanityImage;
  description?: string;
  skills: string[];
  order: number;
}

/**
 * Skill category from Sanity
 */
export interface SkillCategory extends SanityDocument {
  _type: 'skillCategory';
  name: string;
  skills: string[];
  icon?: string;
  order: number;
}

/**
 * Place document from Sanity
 */
export interface Place extends SanityDocument {
  _type: 'place';
  name: string;
  description: string;
  category: 'Hackathon' | 'Conference' | 'Research' | 'Tech Office' | 'Mentorship' | 'Event';
  latitude: number;
  longitude: number;
  photos?: SanityImage[];
  order: number;
  featured: boolean;
}
