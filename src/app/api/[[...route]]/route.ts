import { app } from './elysia';

/**
 * Next.js API route handlers
 * Delegates to Elysia app for all HTTP methods
 */
export const GET = app.handle;
export const POST = app.handle;
export const PUT = app.handle;
export const PATCH = app.handle;
export const DELETE = app.handle;
export const OPTIONS = app.handle;
