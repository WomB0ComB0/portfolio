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
 * @interface Message
 * @description
 * Represents a single message entity used within the messaging system of the portfolio project.
 * Used as both payload and response structure for message-related operations.
 * @property {string} id - The unique identifier of the message.
 * @property {string} message - The textual content of the message.
 * @property {string} authorName - Name of the message's author.
 * @property {string} createdAt - Date string representing message creation.
 * @property {string | null | undefined} [email] - Optional author email address.
 * @author Mike Odnis
 * @version 1.0.0
 * @public
 * @readonly
 * @see https://github.com/WomB0ComB0/portfolio
 */
export interface Message {
  id: string;
  message: string;
  authorName: string;
  createdAt: string;
  email?: string | null;
}

/**
 * @interface ApiResponse
 * @description
 * Defines the structure of the response payload for the messages query API.
 * Useful for caching and querying messages in the client state.
 * @property {{ json: Message[] }} json - Nested object containing an array of Message objects.
 * @author Mike Odnis
 * @version 1.0.0
 * @readonly
 * @public
 */
export interface ApiResponse {
  json: {
    json: Message[];
  };
}

/**
 * @interface MutationContext
 * @description
 * Context structure passed between React Query mutation lifecycle events for message mutations.
 * Contains the previous cached messages, allowing for optimistic UI rollback.
 * @property {ApiResponse | undefined} previousMessages - The previously cached messages query data, or undefined.
 * @author Mike Odnis
 * @version 1.0.0
 * @readonly
 * @private
 */
export interface MutationContext {
  previousMessages: ApiResponse | undefined;
}
