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

import type { SchemaTypeDefinition } from 'sanity';
import { articleType } from './article';
import { certificationType } from './certification';
import { experienceType } from './experience';
import { placeType } from './place';
import { presentationType } from './presentation';
import { projectType } from './project';
import { resumeType } from './resume';
import { talkType } from './talk';
import { youtubeVideoType } from './youtube-video';

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [
    projectType,
    experienceType,
    certificationType,
    placeType,
    resumeType,
    presentationType,
    talkType,
    articleType,
    youtubeVideoType,
  ],
};
