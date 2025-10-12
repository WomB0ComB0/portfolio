import { t } from 'elysia';

export const githubStatsSchema = {
  'github-stats.response': t.Object({
    user: t.Object({
      repos: t.Number(),
      followers: t.Number(),
      avatar_url: t.String(),
    }),
    stats: t.Object({
      totalStars: t.Number(),
      topLanguages: t.Array(t.String()),
    }),
    topRepos: t.Array(
      t.Object({
        name: t.String(),
        description: t.Union([t.String(), t.Null()]),
        stars: t.Number(),
        language: t.Union([t.String(), t.Null()]),
        url: t.String(),
      }),
    ),
  }),
  'github-stats.error': t.Object({
    error: t.String(),
  }),
};
