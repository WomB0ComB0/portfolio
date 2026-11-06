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

/**
 * @file The Live Console primitives. No directive on purpose: server components import from here,
 * and the client parts (LiveNumber, Freshness, SpotlightRoot) carry their own 'use client'.
 * Plain helpers such as formatAge come from modules without a directive, so server code can call
 * them.
 *
 * Not re-exported from the root '@/components' barrel, which pulls cmd and layout into the RSC
 * graph.
 */

export { formatAge, type Timestamp } from './format-age';
export { Freshness, type FreshnessProps } from './freshness';
export { LiveNumber, type LiveNumberProps } from './live-number';
export { PageShell, type PageShellProps } from './page-shell';
export {
  type ChartTone,
  type LeetCodeTone,
  SegmentBar,
  type SegmentBarProps,
  type SegmentBarSegment,
  SegmentBarSkeleton,
  type SegmentBarSkeletonProps,
  type SegmentTone,
} from './segment-bar';
export {
  Sparkline,
  type SparklinePoint,
  type SparklineProps,
  sparklinePoints,
} from './sparkline';
export { SpotlightRoot } from './spotlight-root';
export {
  formatStatValue,
  NUMBER_LOCALE,
  numberFormatter,
  StatStrip,
  type StatStripItem,
  type StatStripProps,
} from './stat-strip';
export {
  type InteractiveStatTileProps,
  type StatDelta,
  type StaticStatTileProps,
  StatTile,
  type StatTileLabelElement,
  type StatTileProps,
  type StatTileSize,
  StatTileSkeleton,
  type StatTileSkeletonProps,
  type StatTileState,
} from './stat-tile';
export { StatusDot, type StatusDotProps, type StatusTone } from './status-dot';
export {
  type InteractiveTileProps,
  type StaticTileProps,
  Tile,
  type TileElement,
  type TilePadding,
  type TileProps,
  type TileTone,
  type TileVariant,
  tileVariants,
} from './tile';
export {
  DEFAULT_TILE_SPAN,
  TileGrid,
  type TileGridElement,
  type TileGridProps,
  type TileSpan,
  tileSpanClass,
} from './tile-grid';
export {
  destinationOf,
  hasDestination,
  NEW_TAB_LABEL,
  SrOnlyWords,
  TileLink,
  type TileLinkProps,
} from './tile-link';
