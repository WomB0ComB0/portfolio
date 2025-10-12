import { t } from 'elysia';

export const topTracksSchema = {
  'top-tracks.response': t.Array(
    t.Object({
      name: t.String(),
      artist: t.Optional(t.String()),
      url: t.Optional(t.String()),
      imageUrl: t.Optional(t.String()),
    }),
  ),
  'top-tracks.error': t.Object({
    error: t.String(),
  }),
};
