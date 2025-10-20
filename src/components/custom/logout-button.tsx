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

import type * as React from 'react';
import type { JSX } from 'react';
import { Button } from '@/components/ui/button';
import { useSignOut } from '@/core/auth';

export function LogoutButton(props: LogoutButtonProps): JSX.Element {
  const { ...other } = props;
  const [signOut, inFlight] = useSignOut();
  return (
    <>
      <Button
        variant={'outline'}
        onClick={signOut}
        disabled={inFlight}
        className={'w-full'}
        {...other}
      >
        Sign Out
      </Button>
    </>
  );
}
export type LogoutButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'>;
