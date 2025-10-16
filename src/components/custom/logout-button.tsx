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
