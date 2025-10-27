import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Configuration options for the pagination hook
 */
interface UsePaginationOptions {
  /** Number of items to display per page */
  itemsPerPage?: number;
  /** Delay in milliseconds before loading more items (for smooth UX) */
  loadDelay?: number;
  /** Intersection Observer threshold (0-1) */
  threshold?: number;
}

/**
 * Return type for the pagination hook
 */
interface UsePaginationReturn<T> {
  /** Currently displayed items */
  displayedItems: T[];
  /** Whether there are more items to load */
  hasMore: boolean;
  /** Whether items are currently being loaded */
  isLoadingMore: boolean;
  /** Ref to attach to the load more trigger element */
  loadMoreRef: React.RefObject<HTMLDivElement | null>;
  /** Function to manually trigger loading more items */
  loadMore: () => void;
  /** Reset pagination to initial state */
  reset: () => void;
  /** Current display count */
  displayCount: number;
  /** Total number of items */
  totalCount: number;
}

/**
 * Custom hook for implementing infinite scroll pagination
 * 
 * @example
 * ```tsx
 * const { displayedItems, hasMore, isLoadingMore, loadMoreRef, loadMore } = 
 *   usePagination(allItems, { itemsPerPage: 9 });
 * 
 * return (
 *   <>
 *     <div className="grid">
 *       {displayedItems.map(item => <ItemCard key={item.id} item={item} />)}
 *     </div>
 *     {hasMore && (
 *       <div ref={loadMoreRef}>
 *         {isLoadingMore ? <LoadingSpinner /> : <LoadMoreButton onClick={loadMore} />}
 *       </div>
 *     )}
 *   </>
 * );
 * ```
 */
export function usePagination<T>(
  items: ReadonlyArray<T> | undefined,
  options: UsePaginationOptions = {}
): UsePaginationReturn<T> {
  const {
    itemsPerPage = 10,
    loadDelay = 500,
    threshold = 0.1,
  } = options;

  const [displayCount, setDisplayCount] = useState(itemsPerPage);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const allItems = items || [];
  const displayedItems = allItems.slice(0, displayCount);
  const hasMore = displayCount < allItems.length;
  const totalCount = allItems.length;

  const loadMore = useCallback(() => {
    if (!hasMore || isLoadingMore) return;

    setIsLoadingMore(true);

    setTimeout(() => {
      setDisplayCount((prev) => Math.min(prev + itemsPerPage, allItems.length));
      setIsLoadingMore(false);
    }, loadDelay);
  }, [hasMore, isLoadingMore, itemsPerPage, allItems.length, loadDelay]);

  const reset = useCallback(() => {
    setDisplayCount(itemsPerPage);
    setIsLoadingMore(false);
  }, [itemsPerPage]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]) {
          if (entries[0].isIntersecting && !isLoadingMore) {
            loadMore();
          }
        }
      },
      { threshold }
    );

    observer.observe(loadMoreRef.current);

    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, loadMore, threshold]);

  // Reset pagination when items array changes (e.g., after filtering)
  useEffect(() => {
    reset();
  }, [items?.length, reset]);

  return {
    displayedItems,
    hasMore,
    isLoadingMore,
    loadMoreRef,
    loadMore,
    reset,
    displayCount,
    totalCount,
  };
}

/**
 * Reusable component for pagination controls
 */
interface PaginationControlsProps {
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMoreRef: React.RefObject<HTMLDivElement | null>;
  onLoadMore: () => void;
  loadingText?: string;
  buttonText?: string;
}

export const PaginationControls: React.FC<PaginationControlsProps> = ({
  hasMore,
  isLoadingMore,
  loadMoreRef,
  onLoadMore,
  loadingText = 'Loading more...',
  buttonText = 'Load More',
}) => {
  if (!hasMore) return null;

  return (
    <div ref={loadMoreRef} className="flex justify-center pt-8">
      {isLoadingMore ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <svg
            className="h-5 w-5 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>{loadingText}</span>
        </div>
      ) : (
        <button
          onClick={onLoadMore}
          className="px-6 py-3 text-sm font-medium rounded-lg bg-secondary/50 hover:bg-primary border border-border/50 hover:border-primary text-secondary-foreground hover:text-primary-foreground transition-all duration-300"
        >
          {buttonText}
        </button>
      )}
    </div>
  );
};