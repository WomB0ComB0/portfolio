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

/**
 * GROQ queries for fetching data from Sanity CMS
 */

/**
 * Fetch all experiences ordered by start date (most recent first)
 */
export const experiencesQuery = `
  *[_type == "experience"] | order(order asc, startDate desc) {
    _id,
    _type,
    _createdAt,
    _updatedAt,
    _rev,
    company,
    position,
    location,
    startDate,
    endDate,
    current,
    description,
    responsibilities,
    technologies,
    logo,
    companyUrl,
    order
  }
`;

/**
 * Fetch a single experience by ID
 */
export const experienceByIdQuery = `
  *[_type == "experience" && _id == $id][0] {
    _id,
    _type,
    _createdAt,
    _updatedAt,
    _rev,
    company,
    position,
    location,
    startDate,
    endDate,
    current,
    description,
    responsibilities,
    technologies,
    logo,
    companyUrl,
    order
  }
`;

/**
 * Fetch all projects ordered by featured status and date
 */
export const projectsQuery = `
  *[_type == "project"] | order(featured desc, order asc, startDate desc) {
    _id,
    _type,
    _createdAt,
    _updatedAt,
    _rev,
    title,
    slug,
    description,
    longDescription,
    image,
    images,
    technologies,
    githubUrl,
    liveUrl,
    featured,
    category,
    startDate,
    endDate,
    order,
    status
  }
`;

/**
 * Fetch featured projects only
 */
export const featuredProjectsQuery = `
  *[_type == "project" && featured == true] | order(order asc, startDate desc) {
    _id,
    _type,
    _createdAt,
    _updatedAt,
    _rev,
    title,
    slug,
    description,
    longDescription,
    image,
    images,
    technologies,
    githubUrl,
    liveUrl,
    featured,
    category,
    startDate,
    endDate,
    order,
    status
  }
`;

/**
 * Fetch a single project by slug
 */
export const projectBySlugQuery = `
  *[_type == "project" && slug.current == $slug][0] {
    _id,
    _type,
    _createdAt,
    _updatedAt,
    _rev,
    title,
    slug,
    description,
    longDescription,
    image,
    images,
    technologies,
    githubUrl,
    liveUrl,
    featured,
    category,
    startDate,
    endDate,
    order,
    status
  }
`;

/**
 * Fetch all certifications ordered by issue date
 */
export const certificationsQuery = `
  *[_type == "certification"] | order(order asc, issueDate desc) {
    _id,
    _type,
    _createdAt,
    _updatedAt,
    _rev,
    title,
    issuer,
    issueDate,
    expiryDate,
    credentialId,
    credentialUrl,
    image,
    description,
    skills,
    order
  }
`;

/**
 * Fetch a single certification by ID
 */
export const certificationByIdQuery = `
  *[_type == "certification" && _id == $id][0] {
    _id,
    _type,
    _createdAt,
    _updatedAt,
    _rev,
    title,
    issuer,
    issueDate,
    expiryDate,
    credentialId,
    credentialUrl,
    image,
    description,
    skills,
    order
  }
`;

/**
 * Fetch all skill categories
 */
export const skillCategoriesQuery = `
  *[_type == "skillCategory"] | order(order asc) {
    _id,
    _type,
    _createdAt,
    _updatedAt,
    _rev,
    name,
    skills,
    icon,
    order
  }
`;

/**
 * Fetch all places ordered by order field
 */
export const placesQuery = `
  *[_type == "place"] | order(order asc) {
    _id,
    _type,
    _createdAt,
    _updatedAt,
    _rev,
    name,
    description,
    category,
    latitude,
    longitude,
    photos,
    order,
    featured
  }
`;

/**
 * Fetch a single place by ID
 */
export const placeByIdQuery = `
  *[_type == "place" && _id == $id][0] {
    _id,
    _type,
    _createdAt,
    _updatedAt,
    _rev,
    name,
    description,
    category,
    latitude,
    longitude,
    photos,
    order,
    featured
  }
`;

/**
 * Get counts for all content types
 */
export const contentCountsQuery = `
  {
    "experiences": count(*[_type == "experience"]),
    "projects": count(*[_type == "project"]),
    "certifications": count(*[_type == "certification"]),
    "skills": count(*[_type == "skillCategory"]),
    "places": count(*[_type == "place"]),
    "presentations": count(*[_type == "presentation"]),
    "talks": count(*[_type == "talk"]),
    "articles": count(*[_type == "article"]),
    "youtubeVideos": count(*[_type == "youtubeVideo"])
  }
`;

/**
 * Fetch all presentations ordered by date (most recent first)
 */
export const presentationsQuery = `
  *[_type == "presentation"] | order(order asc, date desc) {
    _id,
    _type,
    _createdAt,
    _updatedAt,
    _rev,
    title,
    description,
    eventName,
    eventUrl,
    date,
    slidesFormat,
    "slidesPdfUrl": slidesPdf.asset->url,
    slidesPdf,
    slidesUrl,
    videoUrl,
    thumbnailImage,
    tags,
    location,
    order
  }
`;

/**
 * Fetch a single presentation by ID
 */
export const presentationByIdQuery = `
  *[_type == "presentation" && _id == $id][0] {
    _id,
    _type,
    _createdAt,
    _updatedAt,
    _rev,
    title,
    description,
    eventName,
    eventUrl,
    date,
    slidesFormat,
    "slidesPdfUrl": slidesPdf.asset->url,
    slidesPdf,
    slidesUrl,
    videoUrl,
    thumbnailImage,
    tags,
    location,
    order
  }
`;

/**
 * Fetch all talks ordered by date (most recent first)
 */
export const talksQuery = `
  *[_type == "talk"] | order(order asc, date desc) {
    _id,
    _type,
    _createdAt,
    _updatedAt,
    _rev,
    title,
    description,
    venue,
    date,
    videoFormat,
    videoUrl,
    slidesFormat,
    "slidesPdfUrl": slidesPdf.asset->url,
    slidesPdf,
    slidesUrl,
    thumbnailImage,
    duration,
    tags,
    order
  }
`;

/**
 * Fetch a single talk by ID
 */
export const talkByIdQuery = `
  *[_type == "talk" && _id == $id][0] {
    _id,
    _type,
    _createdAt,
    _updatedAt,
    _rev,
    title,
    description,
    venue,
    date,
    videoFormat,
    videoUrl,
    slidesFormat,
    "slidesPdfUrl": slidesPdf.asset->url,
    slidesPdf,
    slidesUrl,
    thumbnailImage,
    duration,
    tags,
    order
  }
`;

/**
 * Fetch all articles ordered by published date (most recent first)
 */
export const articlesQuery = `
  *[_type == "article"] | order(order asc, publishedDate desc) {
    _id,
    _type,
    _createdAt,
    _updatedAt,
    _rev,
    title,
    excerpt,
    publication,
    publicationUrl,
    publishedDate,
    coverImage,
    coAuthors,
    tags,
    order
  }
`;

/**
 * Fetch a single article by ID
 */
export const articleByIdQuery = `
  *[_type == "article" && _id == $id][0] {
    _id,
    _type,
    _createdAt,
    _updatedAt,
    _rev,
    title,
    excerpt,
    publication,
    publicationUrl,
    publishedDate,
    coverImage,
    coAuthors,
    tags,
    order
  }
`;

/**
 * Fetch all YouTube videos ordered by published date (most recent first)
 */
export const youtubeVideosQuery = `
  *[_type == "youtubeVideo"] | order(order asc, publishedDate desc) {
    _id,
    _type,
    _createdAt,
    _updatedAt,
    _rev,
    title,
    description,
    videoId,
    publishedDate,
    thumbnail,
    duration,
    tags,
    order
  }
`;

/**
 * Fetch a single YouTube video by ID
 */
export const youtubeVideoByIdQuery = `
  *[_type == "youtubeVideo" && _id == $id][0] {
    _id,
    _type,
    _createdAt,
    _updatedAt,
    _rev,
    title,
    description,
    videoId,
    publishedDate,
    thumbnail,
    duration,
    tags,
    order
  }
`;
