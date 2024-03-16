import { publicProcedure, router } from "src/server/trpc";
import { firestore } from "src/server/config";
import { addDoc, collection } from "firebase/firestore";
import { z } from "zod";

//Create your collection in Firestore
let sampleCollection = collection(firestore, "sample");

export const samplePOST = router({
  postSample: publicProcedure
    .input(z.object({ email: z.string(), password: z.string() }))
    .mutation(({ input }) => {
      let user = {
        email: input.email,
        password: input.password,
      };

      addDoc(sampleCollection, user);
      return { user };
    }),
});
