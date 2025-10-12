import { Elysia, StatusMap } from 'elysia';

const app = new Elysia({ prefix: '/api/health' }).get('/', () => {
  return new Response('OK', {
    status: StatusMap.OK,
    headers: {
      'Content-Type': 'text/plain',
    },
  });
});

export const GET = app.handle;
