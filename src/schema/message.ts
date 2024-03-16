import { z } from 'zod';

export const messageSchema = z.object({
  id: z.string(),
  content: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Message = z.infer<typeof messageSchema>;