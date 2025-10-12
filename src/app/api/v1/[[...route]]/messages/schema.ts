import { t } from 'elysia';

export const messagesSchema = {
  'messages.get.response': t.Object({
    json: t.Array(
      t.Object({
        id: t.String(),
        authorName: t.String(),
        message: t.String(),
        createdAt: t.String(),
      }),
    ),
  }),
  'messages.post.body': t.Object({
    authorName: t.String({ minLength: 1 }),
    message: t.String({ minLength: 1 }),
  }),
  'messages.post.response': t.Object({
    id: t.String(),
    authorName: t.String(),
    message: t.String(),
    createdAt: t.String(),
  }),
  'messages.error': t.Object({
    error: t.String(),
  }),
};
