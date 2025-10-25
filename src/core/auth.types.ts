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
 * @type {'google.com' | 'github.com' | 'anonymous'}
 * @description
 * Supported sign-in methods for authentication flows using useSignIn hook.
 * - 'google.com': Google OAuth
 * - 'github.com': GitHub OAuth
 * - 'anonymous': Anonymous Firebase Auth
 * @public
 * @author Mike Odnis
 * @see https://firebase.google.com/docs/auth
 * @version 1.0.0
 */
export type SignInMethod = 'google.com' | 'github.com' | 'anonymous';
