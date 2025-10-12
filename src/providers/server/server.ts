import 'server-only';
import type { App } from '@/app/api/v1/[[...routes]]/route';
import { getURL } from '@/utils';
import { edenTreaty } from '@elysiajs/eden';

/**
 * Server-side API client instance created using Elysia's Eden treaty pattern.
 *
 * @remarks
 * This exports a type-safe API client that can only be used on the server-side,
 * preventing accidental client-side usage through the 'server-only' import.
 *
 * @example
 * ```ts
 * // Usage in server-side code:
 * const result = await elysia_server_api.someEndpoint.get()
 * ```
 *
 * @see {@link https://elysiajs.com/eden/treaty.html Eden Treaty Documentation}
 *
 * @returns A type-safe API client instance with endpoints matching the app router structure
 */
const elysia_server_api = edenTreaty<App>(getURL());


export { elysia_server_api };