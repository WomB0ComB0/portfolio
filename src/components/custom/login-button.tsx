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

type LoginButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    signInMethod: SignInMethod;
  },
  'children'
>;
