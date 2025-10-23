/**
 * Copyright 2025 Mike Odnis
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import dynamic from "next/dynamic";
import { constructMetadata } from "@/utils";
import type { JSX } from "react";

const Places = dynamic(
  () =>
    import("@/app/(routes)/(main)/places/_interface/places").then(
      (mod) => mod.Places,
    ),
  {
    ssr: true,
  },
);

export const metadata = constructMetadata({
  title: "Places",
  description:
    "Explore the locations I have visited, including hackathons, tech events, and more",
});

const PlacesPage = (): JSX.Element => {
  return <Places />;
};
PlacesPage.displayName = "PlacesPage";
export default PlacesPage;
