import { t } from 'elysia';

/**
 * Experience Response Schema
 */
export const experienceSchema = t.Object({
  _id: t.String(),
  _type: t.String(),
  _createdAt: t.String(),
  _updatedAt: t.String(),
  company: t.String(),
  position: t.String(),
  location: t.String(),
  startDate: t.String(),
  endDate: t.Optional(t.String()),
  current: t.Boolean(),
  description: t.String(),
  responsibilities: t.Array(t.String()),
  technologies: t.Array(t.String()),
  logo: t.Optional(
    t.Object({
      _type: t.String(),
      asset: t.Object({
        _ref: t.String(),
        _type: t.String(),
      }),
      alt: t.Optional(t.String()),
    }),
  ),
  companyUrl: t.Optional(t.String()),
  order: t.Number(),
});

/**
 * Project Response Schema
 */
export const projectSchema = t.Object({
  _id: t.String(),
  _type: t.String(),
  _createdAt: t.String(),
  _updatedAt: t.String(),
  title: t.String(),
  slug: t.Object({
    _type: t.String(),
    current: t.String(),
  }),
  description: t.String(),
  longDescription: t.Optional(t.String()),
  image: t.Object({
    _type: t.String(),
    asset: t.Object({
      _ref: t.String(),
      _type: t.String(),
    }),
    alt: t.Optional(t.String()),
  }),
  images: t.Optional(t.Array(t.Any())),
  technologies: t.Array(t.String()),
  githubUrl: t.Optional(t.String()),
  liveUrl: t.Optional(t.String()),
  featured: t.Boolean(),
  category: t.String(),
  startDate: t.String(),
  endDate: t.Optional(t.String()),
  order: t.Number(),
  status: t.String(),
});

/**
 * Certification Response Schema
 */
export const certificationSchema = t.Object({
  _id: t.String(),
  _type: t.String(),
  _createdAt: t.String(),
  _updatedAt: t.String(),
  name: t.String(),
  issuer: t.String(),
  issueDate: t.String(),
  expiryDate: t.Optional(t.String()),
  credentialId: t.Optional(t.String()),
  credentialUrl: t.Optional(t.String()),
  logo: t.Optional(
    t.Object({
      _type: t.String(),
      asset: t.Object({
        _ref: t.String(),
        _type: t.String(),
      }),
      alt: t.Optional(t.String()),
    }),
  ),
  description: t.Optional(t.String()),
  skills: t.Array(t.String()),
  order: t.Number(),
});

/**
 * Sanity Schemas Export
 */
export const sanitySchemas = {
  'sanity.experiences': t.Array(experienceSchema),
  'sanity.projects': t.Array(projectSchema),
  'sanity.featuredProjects': t.Array(projectSchema),
  'sanity.certifications': t.Array(certificationSchema),
  'sanity.error': t.Object({
    error: t.String(),
    message: t.Optional(t.String()),
  }),
};

