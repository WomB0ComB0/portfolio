# Project Plan

This document outlines the plan to address the feedback received for the portfolio website.

## Feedback Summary:
1.  **Cursor:** Multiple users find the custom cursor not worth it and potentially problematic.
2.  **Contrast:** The contrast between the font and background should be increased.
3.  **Navbar Tooltips:** Tooltip states in the navbar aren't resetting properly for me.
4.  **Homepage Content:** The homepage should provide an overview of who you are and your qualifications, rather than being a "CS student" playground. The navigation is unclear with too many icons.
5.  **Page Transitions:** The transition between tabs is jarring with a big wolf logo popping up, it also lags a little bit on my browser.
6.  **Navigation Icons:** The icons in the navigation are hard to understand without text, and hovering to see the tooltip is an extra step.
7.  **Mouse Effects:** Mouse effects slow down after switching between tabs.
8.  **Menu Bar:** The bottom menu bar could be replaced with buttons on each side rather than a bar at the bottom so that your menu looks more spacious? Maybe a pop up window or a menu expansion from the button would open with your menu to be selected?
9.  **Blog Post Pictures:** Latest blog posts can use a picture for each post.
10. **Places Map:** The places map feature is liked.

## Actionable Items & Progress:

### 1. Remove Custom Cursor
- [x] Uninstall `react-animated-cursor` package.
- [x] Delete `src/providers/core/custom-animated-cursor.tsx`.
- [x] Delete `src/hooks/use-cursor-fix.ts`.
- [x] Remove cursor-related code from `src/app/_providers/global-provider.tsx`.
- [x] Remove `cursor: none !important;` from `src/styles/globals.css`.
- [x] Remove exports from `src/providers/core/index.ts` and `src/hooks/index.ts`.

### 2. Improve Color Contrast
- [x] Identify areas with low contrast.
- [x] Adjust color palette or specific component styles (darker, richer, bolder purple).

### 3. Fix Navbar Tooltips
- [x] Investigate why tooltip states are not resetting.
- [x] Implement a fix to ensure proper reset (added useEffect to NavBar).

### 4. Redesign Homepage & Simplify Navigation
- [x] Simplify navigation elements by adding text labels to icons.
- [x] Refine homepage introductory content to be more professional and qualifications-focused.

### 5. Improve Page Transitions
- [x] Analyze current transition implementation.
- [x] Optimize or replace jarring transitions (reduced duration, reduced LightRays complexity).

### 6. Rethink Bottom Menu Bar
- [x] Explore alternative designs (e.g., side buttons, pop-up menu).
- [x] Implement chosen design (single menu button opening an overlay).

### 7. Add Pictures to Blog Posts
- [x] Identify blog post components.
- [x] Implement functionality to display images for each post (updated schema and Blog component).
- [x] Update API GraphQL query to fetch imageUrl.
- [x] Update API schema to include imageUrl.
- [x] Fix error in blog.tsx related to imageUrl handling.
- [x] Correct Schema.optional() usage in API handlers and integrations.

### 8. Mouse Effects
- [x] Investigate why mouse effects slow down after switching between tabs.
- [x] Disable mouse effects (commented out .flare CSS).

### 9. Places Map
- [ ] No action needed, as the feature is liked.