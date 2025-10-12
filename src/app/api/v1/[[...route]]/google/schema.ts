import { t } from 'elysia';

export const googleSchema = {
  'google.response': t.Object({
    total_pageviews: t.Optional(t.Number()),
  }),
  'google.error': t.Object({
    total_pageviews: t.Number(),
    error: t.String(),
  }),
};
