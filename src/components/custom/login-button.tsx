import { FaGoogle, FaGithub, FaUserSecret } from "react-icons/fa";
import { Button } from "../ui/button";
import { type SignInMethod, useSignIn } from "@/core/auth";

export function LoginButton({ signInMethod, ...props }: LoginButtonProps) {
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
      variant="outline"
      onClick={signIn}
      disabled={inFlight}
      className="bg-purple-700 text-white hover:bg-purple-600 focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-purple-800"
      {...props}
    >
      {getIcon()}
      {getText()}
    </Button>
  );
}

type LoginButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    signInMethod: SignInMethod;
  },
  'children'
>;
