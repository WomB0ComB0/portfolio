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

"use client"

import { useKBar } from "kbar"
import Link from "next/link"
import { memo, useState } from "react"
import { FiBriefcase, FiCode, FiCommand, FiHome } from "react-icons/fi"
import { Button } from "@/components/ui/button"
import { NavbarItems } from "@/constants/index"
import { AnimatePresence, motion } from "motion/react"
import { cn } from "@/lib/utils"

export const groupNavItems = () => {
  // Define which routes belong to which persona
  const professionalRoutes = ["/experience", "/certifications", "/resume", "/projects"]
  const developerRoutes = ["/blog", "/places", "/guestbook"]
  const homeRoute = "/"

  const professional = NavbarItems.filter((item) => professionalRoutes.includes(item.slug))

  const developer = NavbarItems.filter((item) => developerRoutes.includes(item.slug))

  const home = NavbarItems.find((item) => item.slug === homeRoute)

  return { professional, developer, home }
}

export const NavBar = memo(({ path }: { path: string }) => {
  const { query } = useKBar()
  const [professionalOpen, setProfessionalOpen] = useState(false)
  const [developerOpen, setDeveloperOpen] = useState(false)
  const { professional, developer, home } = groupNavItems()

  const isProfessionalActive = professional.some((item) => path === item.slug)
  const isDeveloperActive = developer.some((item) => path === item.slug)

  return (
    <div className="w-16 h-full flex flex-col items-center py-6 gap-3 border-r border-border/30">
      <nav className="flex flex-col items-center gap-2 w-full px-2" role="navigation" aria-label="Main navigation">
        {/* Home Link */}
        {home && (
          <Button
            asChild
            variant="ghost"
            size="icon"
            className={cn(
              "w-11 h-11 rounded-xl transition-all duration-200 relative group",
              path === home.slug
                ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
                : "hover:bg-accent/70 text-muted-foreground hover:text-foreground",
            )}
            aria-label={home.name}
            aria-current={path === home.slug ? "page" : undefined}
          >
            <Link href={home.slug}>
              <FiHome size="1.25rem" strokeWidth={path === home.slug ? 2.5 : 2} />
            </Link>
          </Button>
        )}

        {/* Professional Dropdown */}
        <div className="relative w-full flex flex-col items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setProfessionalOpen(!professionalOpen)}
            className={cn(
              "w-11 h-11 rounded-xl transition-all duration-200 relative group",
              isProfessionalActive || professionalOpen
                ? "bg-accent text-foreground shadow-sm"
                : "hover:bg-accent/70 text-muted-foreground hover:text-foreground",
            )}
            aria-label="Professional section"
            aria-expanded={professionalOpen}
          >
            <FiBriefcase size="1.25rem" strokeWidth={isProfessionalActive ? 2.5 : 2} />
            {isProfessionalActive && (
              <span className="absolute -right-0.5 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-l-full" />
            )}
          </Button>

          <AnimatePresence>
            {professionalOpen && (
              <motion.div
                initial={{ opacity: 0, x: -10, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute left-full ml-3 top-0 z-50 min-w-[200px] bg-card/95 backdrop-blur-xl border border-border/50 rounded-xl shadow-2xl overflow-hidden"
              >
                <div className="p-2 flex flex-col gap-1">
                  <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Professional
                  </div>
                  {professional.map((item, index) => (
                    <motion.div
                      key={item.slug}
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                    >
                      <Button
                        asChild
                        variant="ghost"
                        className={cn(
                          "w-full justify-start gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                          path === item.slug
                            ? "bg-primary/10 text-primary font-medium"
                            : "hover:bg-accent/50 text-foreground",
                        )}
                        onClick={() => setProfessionalOpen(false)}
                      >
                        <Link href={item.slug} className="flex items-center gap-3">
                          <item.icon size="1.1rem" />
                          <span className="text-sm">{item.name}</span>
                        </Link>
                      </Button>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Developer Dropdown */}
        <div className="relative w-full flex flex-col items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeveloperOpen(!developerOpen)}
            className={cn(
              "w-11 h-11 rounded-xl transition-all duration-200 relative group",
              isDeveloperActive || developerOpen
                ? "bg-accent text-foreground shadow-sm"
                : "hover:bg-accent/70 text-muted-foreground hover:text-foreground",
            )}
            aria-label="Developer section"
            aria-expanded={developerOpen}
          >
            <FiCode size="1.25rem" strokeWidth={isDeveloperActive ? 2.5 : 2} />
            {isDeveloperActive && (
              <span className="absolute -right-0.5 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-l-full" />
            )}
          </Button>

          <AnimatePresence>
            {developerOpen && (
              <motion.div
                initial={{ opacity: 0, x: -10, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute left-full ml-3 top-0 z-50 min-w-[200px] bg-card/95 backdrop-blur-xl border border-border/50 rounded-xl shadow-2xl overflow-hidden"
              >
                <div className="p-2 flex flex-col gap-1">
                  <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Developer
                  </div>
                  {developer.map((item, index) => (
                    <motion.div
                      key={item.slug}
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                    >
                      <Button
                        asChild
                        variant="ghost"
                        className={cn(
                          "w-full justify-start gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                          path === item.slug
                            ? "bg-primary/10 text-primary font-medium"
                            : "hover:bg-accent/50 text-foreground",
                        )}
                        onClick={() => setDeveloperOpen(false)}
                      >
                        <Link href={item.slug} className="flex items-center gap-3">
                          <item.icon size="1.1rem" />
                          <span className="text-sm">{item.name}</span>
                        </Link>
                      </Button>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Divider */}
        <div className="w-8 h-px bg-border/50 my-1" />

        {/* Command Menu Button */}
        <Button
          variant="ghost"
          size="icon"
          className="w-11 h-11 rounded-xl hover:bg-accent/70 text-muted-foreground hover:text-foreground transition-all duration-200"
          onClick={query.toggle}
          aria-label="Open command menu"
        >
          <FiCommand size="1.25rem" />
        </Button>
      </nav>
    </div>
  )
})
NavBar.displayName = "NavBar"
export default NavBar
