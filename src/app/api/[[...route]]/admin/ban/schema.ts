import { t } from 'elysia';

/**
 * Ban action types
 */
export const banActions = [
  'ban',
  'unban',
  'slow',
  'unslow',
  'ban-cidr',
  'unban-cidr',
  'list',
  'list-cidr',
  'get-meta',
] as const;

export type BanAction = (typeof banActions)[number];

/**
 * Request schema for ban operations
 */
export const banRequestSchema = t.Object({
  action: t.Union([
    t.Literal('ban'),
    t.Literal('unban'),
    t.Literal('slow'),
    t.Literal('unslow'),
    t.Literal('ban-cidr'),
    t.Literal('unban-cidr'),
    t.Literal('list'),
    t.Literal('list-cidr'),
    t.Literal('get-meta'),
  ]),
  ip: t.Optional(t.String()),
  cidr: t.Optional(t.String()),
  reason: t.Optional(t.String()),
  seconds: t.Optional(t.Number()),
  bannedBy: t.Optional(t.String()),
});

/**
 * Success response schemas
 */
export const banResponseSchemas = {
  'ban.success': t.Object({
    success: t.Boolean(),
    message: t.Optional(t.String()),
    data: t.Optional(t.Any()),
  }),
  'ban.error': t.Object({
    success: t.Boolean(),
    error: t.String(),
    message: t.Optional(t.String()),
  }),
};

/**
 * Export all schemas for model registration
 */
export const banSchemas = {
  ...banResponseSchemas,
  'ban.request': banRequestSchema,
};
