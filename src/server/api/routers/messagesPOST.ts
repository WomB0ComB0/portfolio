import { firestore } from '@/core/firebase';
import { addDoc, collection } from 'firebase/firestore';
import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../trpc';

//Create your collection in Firestore
const sampleCollection = collection(firestore, 'message');

export const messagesPOST = createTRPCRouter({
  postSample: publicProcedure
    .input(z.object({ email: z.string(), password: z.string() }))
    .mutation(({ input }) => {
      const user = {
        email: input.email,
        password: input.password,
      };

      addDoc(sampleCollection, user);
      return { user };
    }),
});
