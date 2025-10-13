import 'server-only';
import { edenTreaty } from '@elysiajs/eden';
import type { API } from '@/app/api/[[...route]]/route';
import type { API_V1 } from '@/app/api/v1';
import { getURL } from '@/utils';

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
const apiv1 = edenTreaty<API_V1>(getURL());
const api = edenTreaty<API>(getURL());

export { apiv1, api };
