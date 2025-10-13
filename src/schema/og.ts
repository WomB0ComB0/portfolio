import * as z from 'zod';

const OG_RULES = {
  TITLE: {
    MAX_LENGTH: 60,
  },
  DESCRIPTION: {
    MAX_LENGTH: 160,
  },
  TYPE: {
    MAX_LENGTH: 128,
  },
};

export const ogImageSchema = z.object({
  title: z.string().max(OG_RULES.TITLE.MAX_LENGTH, {
    message: `Title must be ${OG_RULES.TITLE.MAX_LENGTH} characters or less`,
  }),
  description: z
    .string()
    .max(OG_RULES.DESCRIPTION.MAX_LENGTH, {
      message: `Description must be ${OG_RULES.DESCRIPTION.MAX_LENGTH} characters or less`,
    })
    .optional(),
  type: z
    .string()
    .max(OG_RULES.TYPE.MAX_LENGTH, {
      message: `Type must be ${OG_RULES.TYPE.MAX_LENGTH} characters or less`,
    })
    .optional(),
  mode: z.enum(['light', 'dark']).default('dark'),
});
