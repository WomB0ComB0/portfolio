/**
 * Copyright 2026 Mike Odnis
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
 * @file When the open view of a photo uses its full-screen layout: the media query its
 * stylesheet (photo-dialog.module.css) and its script (photo-dialog-live.tsx) both read, so the
 * button the script focuses is the one the stylesheet shows. Pure and server-safe.
 */

/**
 * The open view's full-screen layout: a phone, and any short window (a landscape phone, or a
 * laptop zoomed to 200% or more), where the panel and its caption would not fit.
 */
export const COMPACT_QUERY = '(width < 40rem), (height < 32rem)';
