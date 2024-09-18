import { z } from 'zod';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createJSONStorage } from 'zustand/middleware';

const schema = z.object({
  count: z.number(),
  setCount: z.function().args(z.number()).returns(z.void()),
});

export const useStore = create<z.infer<typeof schema>>()(
  persist(
    (set) => ({
      count: 0,
      setCount: (count: number) => set({ count }),
    }),
    {
      name: 'count-storage',
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);
