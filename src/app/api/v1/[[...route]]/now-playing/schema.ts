import { t } from 'elysia';

export const nowPlayingSchema = {
  'now-playing.response': t.Object({
    isPlaying: t.Boolean(),
    songName: t.Optional(t.String()),
    artistName: t.Optional(t.String()),
    songURL: t.Optional(t.String()),
    imageURL: t.Optional(t.String()),
  }),
  'now-playing.error': t.Object({
    error: t.String(),
  }),
};
