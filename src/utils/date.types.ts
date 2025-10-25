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
 * Utility functions for date formatting that prevent hydration mismatches.
 * These functions ensure consistent date formatting between server and client.
 *
 * @module utils/date
 * @author Mike Odnis
 * @version 1.0.0
 */
/**
 * Format options for date display.
 *
 * @interface DateFormatOptions
 * @property {'short' | 'long' | 'numeric'} [month] - Month display format.
 * @property {'numeric' | '2-digit'} [year] - Year display format.
 * @property {'numeric' | '2-digit'} [day] - Day display format.
 * @property {'numeric' | '2-digit'} [hour] - Hour display format.
 * @property {'numeric' | '2-digit'} [minute] - Minute display format.
 */
export interface DateFormatOptions {
  month?: 'short' | 'long' | 'numeric';
  year?: 'numeric' | '2-digit';
  day?: 'numeric' | '2-digit';
  hour?: 'numeric' | '2-digit';
  minute?: 'numeric' | '2-digit';
}
