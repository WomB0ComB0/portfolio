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
  title: z
    .string({
      required_error: 'Title is required',
      invalid_type_error: 'Title must be a string',
    })
    .max(OG_RULES.TITLE.MAX_LENGTH, {
      message: `Title must be ${OG_RULES.TITLE.MAX_LENGTH} characters or less`,
    }),
  description: z
    .string({
      required_error: 'Description is required',
      invalid_type_error: 'Description must be a string',
    })
    .max(OG_RULES.DESCRIPTION.MAX_LENGTH, {
      message: `Description must be ${OG_RULES.DESCRIPTION.MAX_LENGTH} characters or less`,
    })
    .optional(),
  type: z
    .string({
      required_error: 'Type is required',
      invalid_type_error: 'Type must be a string',
    })
    .max(OG_RULES.TYPE.MAX_LENGTH, {
      message: `Type must be ${OG_RULES.TYPE.MAX_LENGTH} characters or less`,
    })
    .optional(),
  mode: z
    .enum(['light', 'dark'], {
      required_error: 'Mode is required',
      invalid_type_error: 'Mode must be either "light" or "dark"',
    })
    .default('dark'),
});
