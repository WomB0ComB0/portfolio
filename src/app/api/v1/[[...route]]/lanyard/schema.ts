import { t } from 'elysia';

export const lanyardSchema = {
  'lanyard.response': t.Object({
    discord_user: t.Object({
      username: t.String(),
      discriminator: t.String(),
      avatar: t.String(),
      id: t.String(),
    }),
    activities: t.Array(
      t.Object({
        name: t.String(),
        type: t.Number(),
        state: t.Optional(t.String()),
        details: t.Optional(t.String()),
      }),
    ),
    discord_status: t.String(),
  }),
  'lanyard.error': t.Object({
    error: t.String(),
  }),
};
