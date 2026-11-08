import type { LoginButtonProps } from './login-button.types';

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
import { useSignIn } from '@/core/auth';
import { Button } from '../ui/button';

/**
 * A provider's sign-in button. Pressing it signs in through src/core/auth, which loads Firebase
 * on demand; while that provider's popup is open the button is busy. The page shows the outcome
 * (the compose box, or the error), and nothing reloads.
 *
 * Busy or `disabled`, it stays focusable: it sets aria-disabled and ignores presses, rather than
 * the native attribute, which would drop a keyboard user's focus to the page while a popup is open.
 */
export const LoginButton = ({ signInMethod, disabled, ...props }: LoginButtonProps) => {
  const [signIn, inFlight] = useSignIn(signInMethod);
  const unavailable = inFlight || Boolean(disabled);

  const getIcon = () => {
    switch (signInMethod) {
      case 'google.com':
        return <FaGoogle aria-hidden="true" />;
      case 'github.com':
        return <FaGithub aria-hidden="true" />;
      case 'anonymous':
        return <FaUserSecret aria-hidden="true" />;
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
        return 'Continue as guest';
      default:
        return 'Unknown';
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={unavailable ? undefined : signIn}
      aria-disabled={unavailable || undefined}
      aria-busy={inFlight || undefined}
      {...props}
    >
      {getIcon()}
      {getText()}
    </Button>
  );
};
LoginButton.displayName = 'LoginButton';
export default LoginButton;
