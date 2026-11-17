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

/**
 * @file Compatibility names for the YouTube channel in the shared public profile. The uploads
 * loader and JSON-LD keep using these exports; the destination is maintained in profile.ts.
 */

import { profile } from '@/constants/profile';

/** The channel whose uploads are listed next to the videos stored in Sanity. */
export const YOUTUBE_CHANNEL_HANDLE = profile.youtube.handle;

/** The channel's page: youtube.com/@handle. */
export const YOUTUBE_CHANNEL_URL = profile.youtube.url;
