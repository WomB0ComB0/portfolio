/**
 * Copyright 2025 Mike Odnis
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { BaseError } from '@/classes/error';
import { config } from "@/config";
import { firestore } from '@/core/firebase';
import { Schema } from 'effect';
import { addDoc, collection, getDocs, limit, orderBy, query } from 'firebase/firestore';

// --- START: PATH CONSTRUCTION FOR FIREBASE SECURITY RULES ---

// 1. Retrieve the mandatory application ID from the environment.
// This ID is required to match the secure path pattern: /artifacts/{appId}/...
const APP_ID = config.firebase.appId;

// 2. Define the full, human-readable collection path using template literals.
// Path structure required by security rules: artifacts/{APP_ID}/public/data/message
const PUBLIC_MESSAGE_PATH = `artifacts/${APP_ID}/public/data/message`;

// **FIX: Use the full, secured path for public messages to satisfy the read rule.**
const messageCollection = collection(firestore, PUBLIC_MESSAGE_PATH);

// --- END: PATH CONSTRUCTION FOR FIREBASE SECURITY RULES ---

export const MessageDataSchema = Schema.Struct({
  authorName: Schema.String,
  message: Schema.String,
  createdAt: Schema.String,
});

export const MessageSchema = Schema.extend(
  MessageDataSchema,
  Schema.Struct({
    id: Schema.String,
  }),
);

export const MessagesResponseSchema = Schema.Struct({
  json: Schema.Array(MessageSchema),
});

export type MessageData = Schema.Schema.Type<typeof MessageDataSchema>;
export type Message = Schema.Schema.Type<typeof MessageSchema>;
export type MessagesResponse = Schema.Schema.Type<typeof MessagesResponseSchema>;

const CACHE_DURATION = 60 * 1000; // 1 minute
let cache: { data: MessagesResponse; timestamp: number } | null = null;

export async function fetchMessages(): Promise<MessagesResponse> {
  const currentTime = Date.now();
  if (cache && currentTime - cache.timestamp < CACHE_DURATION) {
    return cache.data;
  }

  const messagesQuery = query(messageCollection, orderBy('createdAt', 'desc'), limit(50));
  const snapshot = await getDocs(messagesQuery);

  const messages: Message[] = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      authorName: data.authorName as string,
      message: data.message as string,
      createdAt: data.createdAt as string,
    };
  });

  const result: MessagesResponse = { json: messages };

  cache = { data: result, timestamp: Date.now() };

  return result;
}

export async function createMessage(data: {
  authorName: string;
  message: string;
}): Promise<Message> {
  const { authorName, message } = data;

  if (!message) {
    throw new BaseError(new Error('Message is undefined'), 'message:create', {
      authorName,
      hasMessage: !!message,
    });
  }

  const newMessage = { authorName, message, createdAt: new Date().toISOString() };
  const docRef = await addDoc(messageCollection, newMessage);

  const addedMessage: Message = {
    id: docRef.id,
    ...newMessage,
  };

  return addedMessage;
}
