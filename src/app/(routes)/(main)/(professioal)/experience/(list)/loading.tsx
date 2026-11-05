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
 * @file The /experience timeline's skeleton while the list loads. It sits in the (list) route
 * group, so /experience/[id] is outside it: a loading boundary above a detail page would answer
 * 200 before that page's notFound() could answer 404.
 */

import type { JSX } from 'react';
import { ExperienceListSkeleton } from '@/app/(routes)/(main)/(professioal)/experience/_interface/experience-list/experience-list';

export default function ExperienceLoading(): JSX.Element {
  return <ExperienceListSkeleton />;
}
