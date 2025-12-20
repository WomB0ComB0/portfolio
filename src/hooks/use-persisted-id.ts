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

import { useQueryState } from 'nuqs';
import { useCallback } from 'react';
import { useIsomorphicLayoutEffect } from 'usehooks-ts';
import { v4 as uuidv4 } from 'uuid';

export const usePersistedId = (
  key: string,
): {
  id: string | null;
  clearId: () => void;
  setPersistedId: (newId: string) => void;
  generateNewId: () => string;
} => {
  const [id, setId] = useQueryState(key);

  const clearId = useCallback(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(key);
    }
    setId(null);
  }, [key, setId]);

  const setPersistedId = useCallback(
    (newId: string) => {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(key, newId);
      }
      setId(newId);
    },
    [key, setId],
  );

  const generateNewId = useCallback(() => {
    const newId = uuidv4();
    setPersistedId(newId);
    return newId;
  }, [setPersistedId]);

  useIsomorphicLayoutEffect(() => {
    if (typeof window !== 'undefined') {
      const existingId = sessionStorage.getItem(key);
      if (existingId && !id) {
        setId(existingId);
      }
    }
  }, [key, id, setId]);

  return { id: id ?? null, clearId, setPersistedId, generateNewId };
};
