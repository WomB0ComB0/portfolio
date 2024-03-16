import { cn } from "@/lib/utils"
import { 
  GitHubForkIcon as GitHubFork,
  GitHubStarIcon as GitHubStar,
  LogoIcon as Logo
} from "./components"

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
  }
}