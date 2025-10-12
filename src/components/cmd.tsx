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
import {
  Book,
  Code,
  FileText,
  Headphones,
  Home,
  Link,
  Map,
  User,
  Zap,
} from 'lucide-react';
import React from 'react';
import { FiDollarSign } from 'react-icons/fi';
import { SiHashnode } from 'react-icons/si';

export default function Palette() {
  return (
    <KBarPortal>
      <KBarPositioner className="z-50 select-none backdrop-blur bg-[#242424]/80 font-clash overflow-hidden">
        <KBarAnimator className="w-[90%] max-w-[600px] overflow-hidden text-lg bg-[#242424] text-[#ba9bdd] rounded-lg shadow-2xl kbar">
          <KBarSearch
            className="w-full p-4 text-base bg-[#242424] text-[#ba9bdd] border-b border-[#560BAD]/30 outline-none placeholder-[#ba9bdd]/50 focus:ring-2 focus:ring-[#560BAD]"
            placeholder="Type a command or search..."
          />
          <RenderResults />
        </KBarAnimator>
      </KBarPositioner>
    </KBarPortal>
  );
}

function RenderResults() {
  const { results, rootActionId } = useMatches();

  return (
    <KBarResults
      items={results}
      onRender={({ item, active }) =>
        typeof item === 'string' ? (
          <div className="px-4 py-2 text-xs text-[#ba9bdd]/70 uppercase" key={item}>
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

const ResultItem = React.forwardRef(
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
  ) => {
    const ancestors = React.useMemo(() => {
      if (!currentRootActionId) return action.ancestors;
      const index = action.ancestors.findIndex((ancestor) => ancestor.id === currentRootActionId);
      return action.ancestors.slice(index + 1);
    }, [action.ancestors, currentRootActionId]);

    const getIcon = (name: string) => {
      switch (name.toLowerCase()) {
        case 'home':
          return <Home size={18} />;
        case 'about':
          return <User size={18} />;
        case 'resume':
          return <FileText size={18} />;
        case 'blog':
          return <SiHashnode size={18} />;
        case 'places':
          return <Map size={18} />;
        case 'links':
          return <Link size={18} />;
        case 'guestbook':
          return <Book size={18} />;
        case 'spotify':
          return <Headphones size={18} />;
        case 'dashboard':
          return <Zap size={18} />;
        case 'projects':
          return <Code size={18} />;
        case 'hire':
          return <FiDollarSign size={18} />;
        default:
          return null;
      }
    };

    return (
      <div
        ref={ref}
        className={`px-4 py-2 flex items-center justify-between cursor-pointer transition-all ${
          active ? 'bg-[#560BAD] text-[#ba9bdd]' : 'text-[#ba9bdd] hover:bg-[#560BAD]/20'
        }`}
      >
        <div className="flex items-center gap-3">
          {getIcon(action.name)}
          <div className="flex flex-col">
            <div className="flex items-center gap-2 text-sm">
              {ancestors.length > 0 &&
                ancestors.map((ancestor) => (
                  <React.Fragment key={ancestor.id}>
                    <span className="text-[#ba9bdd]/70">{ancestor.name}</span>
                    <span className="text-[#ba9bdd]/50">&rsaquo;</span>
                  </React.Fragment>
                ))}
              <span>{action.name}</span>
            </div>
            {action.subtitle && (
              <span className="text-xs text-[#ba9bdd]/50">{action.subtitle}</span>
            )}
          </div>
        </div>
        {action.shortcut?.length ? (
          <div className="flex items-center">
            {action.shortcut.map((sc) => (
              <kbd
                key={sc}
                className="px-2 py-1 ml-2 text-xs bg-[#560BAD]/30 text-[#ba9bdd] rounded"
              >
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
