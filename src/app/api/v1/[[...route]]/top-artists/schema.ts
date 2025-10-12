import { t } from 'elysia';

export const topArtistsSchema = {
  'top-artists.response': t.Array(
    t.Object({
      name: t.String(),
      url: t.String(),
      imageUrl: t.Optional(t.String()),
    }),
  ),
  'top-artists.error': t.Object({
    error: t.String(),
  }),
};
