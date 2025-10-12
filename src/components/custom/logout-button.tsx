import type * as React from 'react';
import { Button } from '@/components/ui/button';
import { signout, useSignOut } from '@/core/auth';
import { JSX } from 'react';

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
        {signout}
      </Button>
    </>
  );
}

export type LogoutButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'>;
