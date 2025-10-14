"use client"

import { AlertTriangle, Home, RotateCw } from "lucide-react"
import { motion } from "motion/react"
import type React from "react"
import { memo } from "react"
import { Button } from "@/components/ui/button"

const ErrorLayout: React.FC<{
  title: string
  description: string
  error?: Error & { digest?: string }
  reset?: () => void
}> = memo(
  ({
    title,
    description,
    reset,
    error,
  }: {
    title: string
    description: string
    error?: Error & { digest?: string }
    reset?: () => void
  }): React.JSX.Element => {
    return (
      <div className="relative flex flex-col items-center justify-center min-h-screen overflow-hidden p-4 gap-3">
        <motion.div
          style={{
            zIndex: 10,
            maxWidth: "28rem",
            width: "100%",
            paddingLeft: "1rem",
            paddingRight: "1rem",
            textAlign: "center",
          }}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-6" />
          <h1
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold text-white mb-6 sm:mb-8"
            style={{
              fontFamily: "Kodchasan, serif",
              textShadow: "0 0 10px rgba(0,0,0,0.2)",
            }}
          >
            {title}
          </h1>
          <p
            className="mt-2 text-base text-white/80 mb-10"
            style={{
              fontFamily: "Kodchasan, serif",
            }}
          >
            {description}
          </p>
          <div className="mt-6 flex flex-col gap-4">
            <Button
              size="lg"
              className="w-full bg-white/10 text-white hover:bg-white/20"
              variant="outline"
              onClick={() => (reset ? reset() : window.location.reload())}
            >
              <RotateCw className="w-4 h-4 mr-2" />
              Try again
            </Button>
            <Button
              onClick={() => (window.location.href = "/")}
              className="w-full bg-primary text-white hover:bg-primary/90"
            >
              <Home className="w-5 h-5 sm:w-6 sm:h-6 mr-2" />
              Go back home
            </Button>
          </div>
          {error?.digest && <p className="mt-8 text-sm text-white/60">Error ID: {error.digest}</p>}
        </motion.div>
      </div>
    )
  },
)

ErrorLayout.displayName = "ErrorLayout"
export { ErrorLayout }
