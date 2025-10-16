import { t } from 'elysia';

/**
 * Immutable array of ban action type strings for administrative operations.
 *
 * @readonly
 * @public
 * @author Mike Odnis
 * @version 1.0.0
 * @see {@link BanAction}
 * @see https://github.com/WomB0ComB0/portfolio
 * @example
 * if (banActions.includes(inputAction)) { ... }
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

/**
 * Type representing all valid ban action string values.
 *
 * @public
 * @author Mike Odnis
 * @see {@link banActions}
 * @version 1.0.0
 * @example
 * function handleBanAction(action: BanAction) { ... }
 */
export type BanAction = (typeof banActions)[number];

/**
 * Schema definition for ban-related API requests.
 *
 * Useful for validating and typing administrative ban requests.
 *
 * @public
 * @readonly
 * @author Mike Odnis
 * @see https://elysiajs.com/docs/types.html
 * @see {@link BanAction}
 * @version 1.0.0
 * @example
 * // Creating a ban request
 * const req = {
 *   action: 'ban',
 *   ip: '192.168.0.1',
 *   reason: 'Spam attempt'
 * }
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
 * Schemas representing the possible success or error responses
 * from ban administrative API actions.
 *
 * These are consumed by route handlers for response validation.
 *
 * @public
 * @readonly
 * @author Mike Odnis
 * @see {@link banRequestSchema}
 * @version 1.0.0
 * @example
 * banResponseSchemas['ban.success']
 * banResponseSchemas['ban.error']
 */
export const banResponseSchemas = {
  /**
   * Schema for a successful ban-related API response.
   *
   * @type {object}
   * @property {boolean} success Indicates operation was successful
   * @property {string} [message] Optional success message
   * @property {any} [data] Optional data payload
   * @readonly
   */
  'ban.success': t.Object({
    success: t.Boolean(),
    message: t.Optional(t.String()),
    data: t.Optional(t.Any()),
  }),
  /**
   * Schema for a failed ban-related API response.
   *
   * @type {object}
   * @property {boolean} success Always false on error
   * @property {string} error Description of the error encountered
   * @property {string} [message] Optional error message
   * @readonly
   */
  'ban.error': t.Object({
    success: t.Boolean(),
    error: t.String(),
    message: t.Optional(t.String()),
  }),
};

/**
 * Collection of all ban-related schemas for API model registration.
 *
 * @public
 * @readonly
 * @author Mike Odnis
 * @version 1.0.0
 * @see {@link banResponseSchemas}
 * @see {@link banRequestSchema}
 * @see https://github.com/WomB0ComB0/portfolio
 * @example
 * banSchemas['ban.request']
 * banSchemas['ban.success']
 */
export const banSchemas = {
  ...banResponseSchemas,
  'ban.request': banRequestSchema,
};
