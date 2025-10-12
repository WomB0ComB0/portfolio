import { t } from 'elysia';

export const wakatimeSchema = {
  'wakatime.response': t.Object({
    text: t.String(),
    digital: t.String(),
    decimal: t.String(),
    total_seconds: t.Number(),
  }),
  'wakatime.error': t.Object({
    error: t.String(),
  }),
};
