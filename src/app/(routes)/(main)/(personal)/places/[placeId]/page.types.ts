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

/** The place page's route props. */
export interface PlacePageProps {
  params: Promise<{
    placeId: string;
  }>;
}

/** A photo as the viewer shows it, its URLs built on the server. */
export interface ViewerPhoto {
  /** The whole photo, for the frame. */
  url: string;
  /** A 4:3 crop for the photo strip under the frame. */
  thumb: string;
  caption?: string;
  /** The caption, or "Photo of <place>" when it has none. */
  alt: string;
}
