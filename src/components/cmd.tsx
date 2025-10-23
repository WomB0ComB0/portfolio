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

import {
  type ActionId,
  type ActionImpl,
  KBarAnimator,
  KBarPortal,
  KBarPositioner,
  KBarResults,
  KBarSearch,
  useMatches,
} from 'kbar';
import React, { type JSX } from 'react';
import {
  FiAward,
  FiBarChart,
  FiBookOpen,
  FiBriefcase,
  FiClipboard,
  FiFileText,
  FiHeadphones,
  FiHeart,
  FiHome,
  FiMapPin,
  FiUser,
} from 'react-icons/fi';
import { SiHashnode } from 'react-icons/si';

/**
 * @function Palette
 * @public
 * @description Renders the command palette modal interface using KBar components. Provides a styled search UI and result display for quick command or navigation actions within the application.
 * @returns {JSX.Element} A React element rendering the palette modal and search results.
 * @author Mike Odnis
 * @web
 * @see https://github.com/WomB0ComB0/portfolio
 * @version 1.0.0
 * @example
 *   <Palette />
 */
export const Palette = (): JSX.Element => {
  return (
    <KBarPortal>
      <KBarPositioner className="z-50 select-none backdrop-blur bg-background/80 font-clash overflow-hidden">
        <KBarAnimator className="w-[90%] max-w-[600px] overflow-hidden text-lg bg-background text-foreground rounded-lg shadow-2xl kbar">
          <KBarSearch
            className="w-full p-4 text-base bg-background text-foreground border-b border-accent/30 outline-none placeholder-foreground/50 focus:ring-2 focus:ring-accent"
            placeholder="Type a command or search..."
          />
          <RenderResults />
        </KBarAnimator>
      </KBarPositioner>
    </KBarPortal>
  );
};
Palette.displayName = 'Palette';
export default Palette;

/**
 * @function RenderResults
 * @private
 * @description Renders the results section in the command palette. Maps each result to either a section header or a ResultItem component, coordinating ancestor context for each action.
 * @returns {JSX.Element} A React fragment rendering all matched command results or section headers.
 * @author Mike Odnis
 * @see https://kbar.vercel.app/docs/usage
 * @version 1.0.0
 */
function RenderResults(): JSX.Element {
  const { results, rootActionId } = useMatches();

  return (
    <KBarResults
      items={results}
      onRender={({ item, active }) =>
        typeof item === 'string' ? (
          <div className="px-4 py-2 text-xs text-foreground/70 uppercase" key={item}>
            {item}
          </div>
        ) : (
          <ResultItem
            key={item.id}
            action={item}
            active={active}
            currentRootActionId={rootActionId!}
          />
        )
      }
    />
  );
}

/**
 * @readonly
 * @public
 * @description
 * Displays an individual action within the KBar results, supporting nested actions (ancestors), shortcut display, and dynamic icon mapping based on action name.
 * @param {object} props The properties object.
 * @param {ActionImpl} props.action The action entry details to render.
 * @param {boolean} props.active Whether this result is the currently selected/active result.
 * @param {ActionId} props.currentRootActionId The root action context for ancestor calculation.
 * @param {React.Ref<HTMLDivElement>} ref Reference to the container div element, set by KBar for keyboard navigation.
 * @returns {JSX.Element} The rendered action result entry.
 * @author Mike Odnis
 * @web
 * @see https://kbar.vercel.app/docs/components/results
 * @version 1.0.0
 * @example
 *   <ResultItem action={action} active={isActive} currentRootActionId={rootId} ref={ref} />
 */
export const ResultItem = React.forwardRef(
  (
    {
      action,
      active,
      currentRootActionId,
    }: {
      action: ActionImpl;
      active: boolean;
      currentRootActionId: ActionId;
    },
    ref: React.Ref<HTMLDivElement>,
  ): JSX.Element => {
    /**
     * @description
     * Computes the ancestors for the displayed action, omitting any that are present in the current root action context.
     * @type {ActionImpl['ancestors']}
     */
    const ancestors = React.useMemo(() => {
      if (!currentRootActionId) return action.ancestors;
      const index = action.ancestors.findIndex((ancestor) => ancestor.id === currentRootActionId);
      return action.ancestors.slice(index + 1);
    }, [action.ancestors, currentRootActionId]);

    /**
     * @function getIcon
     * @private
     * @description Maps an action name to its associated icon React component.
     * @param {string} name The action name to look up.
     * @returns {JSX.Element | null} The corresponding icon element, or null if not mapped.
     */
    const getIcon = (name: string): JSX.Element | null => {
      switch (name.toLowerCase()) {
        case 'home':
          return <FiHome size={18} />;
        case 'projects':
          return <FiClipboard size={18} />;
        case 'experience':
          return <FiBriefcase size={18} />;
        case 'certifications':
          return <FiAward size={18} />;
        case 'resume':
          return <FiFileText size={18} />;
        case 'blog':
          return <SiHashnode size={18} />;
        case 'places':
          return <FiMapPin size={18} />;
        case 'stats':
          return <FiBarChart size={18} />;
        case 'spotify':
          return <FiHeadphones size={18} />;
        case 'guestbook':
          return <FiBookOpen size={18} />;
        case 'sponsor':
          return <FiHeart size={18} />;
        case 'about':
          return <FiUser size={18} />;
        default:
          return null;
      }
    };

    return (
      <div
        ref={ref}
        className={`px-4 py-2 flex items-center justify-between cursor-pointer transition-all ${
          active ? 'bg-accent text-foreground' : 'text-foreground hover:bg-accent/20'
        }`}
      >
        <div className="flex items-center gap-3">
          {getIcon(action.name)}
          <div className="flex flex-col">
            <div className="flex items-center gap-2 text-sm">
              {ancestors.length > 0 &&
                ancestors.map((ancestor) => (
                  <React.Fragment key={ancestor.id}>
                    <span className="text-foreground/70">{ancestor.name}</span>
                    <span className="text-foreground/50">&rsaquo;</span>
                  </React.Fragment>
                ))}
              <span>{action.name}</span>
            </div>
            {action.subtitle && (
              <span className="text-xs text-foreground/50">{action.subtitle}</span>
            )}
          </div>
        </div>
        {action.shortcut?.length ? (
          <div className="flex items-center">
            {action.shortcut.map((sc) => (
              <kbd key={sc} className="px-2 py-1 ml-2 text-xs bg-accent/30 text-foreground rounded">
                {sc}
              </kbd>
            ))}
          </div>
        ) : null}
      </div>
    );
  },
);
ResultItem.displayName = 'ResultItem';
