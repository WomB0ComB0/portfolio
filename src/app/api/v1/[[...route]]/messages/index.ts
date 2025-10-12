import { Elysia, StatusMap } from 'elysia';
import { createMessage, fetchMessages } from './handlers';
import { cacheHeaders, errorHandler } from './middleware';
import { messagesSchema } from './schema';

export const messagesRoute = new Elysia({ prefix: '/messages' })
  .model(messagesSchema)
  .get(
    '/',
    async ({ set }) => {
      try {
        const data = await fetchMessages();
        set.headers = cacheHeaders();
        return data;
      } catch (error) {
        const errorResponse = errorHandler(error, 'fetch');
        set.status = StatusMap['Internal Server Error'];
        return { error: errorResponse.error };
      }
    },
    {
      response: {
        200: 'messages.get.response',
        500: 'messages.error',
      },
    },
  )
  .post(
    '/',
    async ({ body, set }) => {
      try {
        const newMessage = await createMessage(body);
        set.status = StatusMap.Created;
        set.headers = cacheHeaders();
        return newMessage;
      } catch (error) {
        const errorResponse = errorHandler(error, 'add');
        set.status = StatusMap['Internal Server Error'];
        return { error: errorResponse.error };
      }
    },
    {
      body: 'messages.post.body',
      response: {
        201: 'messages.post.response',
        500: 'messages.error',
      },
    },
  );
