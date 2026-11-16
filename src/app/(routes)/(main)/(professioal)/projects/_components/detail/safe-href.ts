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
 * @file The project page's door to the one rule for a link Studio holds (a live site or source
 * code): kept only when it is a real http or https address. The rule lives in
 * _lib/project-links.ts, which /projects builds its Live and Code links with, so the list and the
 * page never disagree. No CSS or React here, so any server or client module can import it.
 */

export { safeHref, webUrl } from '../../_lib/project-links';
