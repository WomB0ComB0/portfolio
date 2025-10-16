import { cn } from '@/lib/utils';
import {
  GitHubForkIcon as GitHubFork,
  GitHubStarIcon as GitHubStar,
  LogoIcon as Logo,
} from './components';

/**
 * @interface IconsProps
 * @readonly
 * Maps descriptive icon group keys to React functional icon renderers,
 * ensuring a standardized, easily consumed API for SVG icon usage across the application.
 *
 * @see https://github.com/WomB0ComB0/portfolio
 * @author Mike Odnis
 * @version 1.0.0
 */

/**
 * Icon set registry for the Portfolio project.
 * Provides functional Renderers for app-wide SVG icons including logo and GitHub-related icons.
 *
 * @readonly
 * @type {IconsProps}
 * @property {function({className?: string, size?: string|number, props?: React.SVGProps<SVGSVGElement>}): JSX.Element} logo Renders the main portfolio logo SVG with customizable size and classes.
 * @property {object} github GitHub-related icons.
 * @property {function({className?: string, size?: string|number, props?: React.SVGProps<SVGSVGElement>}): JSX.Element} github.gitHubFork Renders the GitHub fork icon.
 * @property {function({className?: string, size?: string|number, props?: React.SVGProps<SVGSVGElement>}): JSX.Element} github.gitHubStar Renders the GitHub star icon.
 *
 * @example
 * // Rendering the main logo icon
 * <Icons.logo className="text-purple-700" size="6" />
 *
 * @example
 * // Rendering a GitHub fork icon
 * <Icons.github.gitHubFork size="4" />
 *
 * @throws {Error} If icon components fail to render within the context of React.
 * @web
 * @see https://github.com/WomB0ComB0/portfolio/tree/main/src/components/icons
 * @author Mike Odnis
 * @public
 * @version 1.0.0
 */
export const Icons: IconsProps = {
  logo: ({ className, size = '4', props }) => (
    <>
      <Logo className={cn(className, `w-${size} h-${size}`)} {...props} />
    </>
  ),
  github: {
    gitHubFork: ({ className, size = '4', props }) => (
      <GitHubFork className={cn(className, `w-${size} h-${size}`)} {...props} />
    ),
    gitHubStar: ({ className, size = '4', props }) => (
      <GitHubStar className={cn(className, `w-${size} h-${size}`)} {...props} />
    ),
  },
};

export default Icons;
