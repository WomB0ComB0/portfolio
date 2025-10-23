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

import { FaGithub, FaGoogle, FaUserSecret } from 'react-icons/fa';
import { type SignInMethod, useSignIn } from '@/core/auth';
import { Button } from '../ui/button';

export const LoginButton = ({ signInMethod, ...props }: LoginButtonProps) => {
  const [signIn, inFlight] = useSignIn(signInMethod);

  const getIcon = () => {
    switch (signInMethod) {
      case 'google.com':
        return <FaGoogle className="mr-2" />;
      case 'github.com':
        return <FaGithub className="mr-2" />;
      case 'anonymous':
        return <FaUserSecret className="mr-2" />;
      default:
        return null;
    }
  };

  const getText = () => {
    switch (signInMethod) {
      case 'google.com':
        return 'Continue with Google';
      case 'github.com':
        return 'Continue with GitHub';
      case 'anonymous':
        return 'Continue as Guest';
      default:
        return 'Unknown';
    }
  };

  return (
    <Button
      variant="default"
      onClick={signIn}
      disabled={inFlight}
      className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      {...props}
    >
      {getIcon()}
      {getText()}
    </Button>
  );
};
LoginButton.displayName = 'LoginButton';
export default LoginButton;

type LoginButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    signInMethod: SignInMethod;
  },
  'children'
>;
