'use client';

/**
 * Copyright 2026 Mike Odnis
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
 * @file The Screens view of /projects (?view=screens): every image of every project the filters
 * keep, as the /places Photos view shows its photos (the owner's 'take inspiration from what we
 * did with the /places routes'), built from the places parts themselves: the endless wall, the
 * captioned grid, the touch screen's full-screen Wall sheet and the open view, each given this
 * page's words (images of projects) and links (each project's page). Like /places:
 * - A mouse or trackpad starts on the wall, with a Wall / Grid switch in place.
 * - A touch screen starts on the grid; Wall opens the wall full screen.
 * - Without script: the grid alone, every image a link to its project, no switch.
 * - Fewer than WALL_MIN_SCREENS images, or a wall whose code failed to load: the grid alone.
 * Before hydration the server can't know the pointer, so it sends the grid and the wall's empty
 * frame, and CSS shows the one the script will keep, by the same query; nothing shifts. The
 * choice is this visit's only (as on /places): never stored, never in the URL. Every image is
 * listed: the grid has no 'Show all' step, and it names a project once per run of its images
 * (its first image carries the name and dates, the rest their figure number), in a justified
 * contact sheet from a 40rem window, as the project page shows its screens.
 *
 * Its first row (Wall / Grid and the count) is the page's views row here, with the page's
 * Stories | Index | Screens switch at its end, right under the filter bar.
 */

import {
  type ReactElement,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  PhotoDialog,
  preloadPhotoDialog,
} from '@/app/(routes)/(main)/(personal)/places/photos/_components/photo-dialog';
import { PhotoGrid } from '@/app/(routes)/(main)/(personal)/places/photos/_components/photo-grid';
import type {
  OpenPhoto,
  OpenRequest,
} from '@/app/(routes)/(main)/(personal)/places/photos/_components/photo-types';
import {
  PhotoWall,
  PhotoWallSheet,
} from '@/app/(routes)/(main)/(personal)/places/photos/_components/photo-wall';
import { useFinePointer } from '@/hooks/use-fine-pointer';
import { useIsServerHtmlRender } from '@/hooks/use-is-server-html-render';
import type { PhotoPlace, WallPhoto } from '@/types/places';
import type { ProjectEntry } from '../_lib/project-index';
import {
  imagesFromProjects,
  OPEN_PROJECT_LABEL,
  SCREENS_GRID_LABEL,
  SCREENS_WALL_HINTS,
  SCREENS_WALL_ROLE,
  type ScreenProject,
  screenAnnouncement,
  screenCaption,
  screenProjectsOf,
  screenSuffix,
  screensOf,
  screensSheetTitle,
} from '../_lib/project-screens';
import { projectHref } from '../_lib/project-text';

/** Below this many images the wall would repeat a few across the whole window: grid only. */
const WALL_MIN_SCREENS = 12;

type ViewKind = 'wall' | 'grid';

const VIEWS: readonly { readonly value: ViewKind; readonly label: string }[] = [
  { value: 'wall', label: 'Wall' },
  { value: 'grid', label: 'Grid' },
];

const ROOT_CLASS = 'group/screens flex min-w-0 flex-col gap-4';
/** Wall / Grid, the count, then the page's view switch (at the row's end on a wide page). */
const BAR_CLASS = 'flex flex-wrap items-center gap-x-4 gap-y-2';
/**
 * The Wall / Grid switch, in the house's segmented look (the colours flip at once; only a press
 * moves, on the spring). It waits, hidden with its space kept, until it works; without script it
 * is gone.
 */
const SWITCH_CLASS = [
  'inline-flex gap-1 rounded-[0.625rem] bg-surface-1 p-1 shadow-[inset_0_0_0_1px_var(--hairline)]',
  'invisible group-data-[start=ready]/screens:visible [@media(scripting:none)]:hidden',
].join(' ');
const OPTION_CLASS = [
  'inline-flex min-h-9 items-center rounded-[0.4375rem] px-3.5 tile-label text-muted-foreground pointer-coarse:min-h-11',
  'transition-[scale] duration-(--motion-spring-out) ease-spring hover:text-foreground',
  'active:scale-[0.96] active:duration-(--motion-instant) motion-reduce:active:scale-100',
  'aria-pressed:bg-brand-subtle aria-pressed:text-foreground aria-pressed:shadow-[inset_0_0_0_1px_var(--brand-edge)]',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
  'forced-colors:border forced-colors:border-[color:ButtonBorder] forced-colors:aria-pressed:border-[color:Highlight] forced-colors:aria-pressed:bg-[color:Highlight] forced-colors:aria-pressed:text-[color:HighlightText] forced-colors:aria-pressed:[forced-color-adjust:none]',
].join(' ');
const NOTE_CLASS = 'tile-meta text-faint';
/**
 * Before the script knows the pointer (data-start="either"), a mouse or trackpad sees the wall's
 * frame and everyone else the grid, by the query useFinePointer reads (plus scripting: enabled);
 * once it knows (data-start="ready"), only the view it keeps is drawn. Without script
 * (data-start never "ready"), the grid alone.
 */
const WALL_BLOCK_CLASS =
  'hidden group-data-[start=ready]/screens:block [@media(hover:hover)_and_(pointer:fine)_and_(scripting:enabled)]:group-data-[start=either]/screens:block';
const GRID_BLOCK_CLASS =
  '[@media(hover:hover)_and_(pointer:fine)_and_(scripting:enabled)]:group-data-[start=either]/screens:hidden';

export interface ProjectScreensProps {
  /** The projects the filters keep, in page order (those without images add none). */
  readonly entries: readonly ProjectEntry[];
  /** The page's view switch, drawn at the end of the first row. */
  readonly views?: ReactNode;
}

/**
 * Starts fetching the open view's code on the first sign of intent inside `root`: a pointer over
 * it or focus in it. Once is enough; the module stays loaded.
 */
function usePreloadOnIntent(root: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const element = root.current;
    if (!element) return undefined;
    const preload = (): void => {
      element.removeEventListener('pointerover', preload);
      element.removeEventListener('focusin', preload);
      preloadPhotoDialog();
    };
    element.addEventListener('pointerover', preload);
    element.addEventListener('focusin', preload);
    return () => {
      element.removeEventListener('pointerover', preload);
      element.removeEventListener('focusin', preload);
    };
  }, [root]);
}

/** This page's words for the places parts: images of projects, each linking to its project. */
function useScreenWords(projects: ReadonlyMap<string, ScreenProject>, images: number) {
  return useMemo(() => {
    const metaOf = (place: PhotoPlace): readonly string[] => projects.get(place.id)?.meta ?? [];
    const hrefOf = (photo: WallPhoto): string => projectHref(photo.placeId);
    return {
      label: imagesFromProjects(images, projects.size),
      wall: {
        roleDescription: SCREENS_WALL_ROLE,
        describe: (photo: WallPhoto, place: PhotoPlace) =>
          screenAnnouncement(photo, place, metaOf(place)),
      },
      grid: {
        hrefOf,
        metaOf,
        suffixOf: screenSuffix,
        first: images,
        label: SCREENS_GRID_LABEL,
        runs: true,
      },
      dialog: {
        openHref: hrefOf,
        openLabel: OPEN_PROJECT_LABEL,
        caption: (photo: WallPhoto, place: PhotoPlace) =>
          screenCaption(photo, place, metaOf(place)),
      },
      sheetTitle: screensSheetTitle(images, projects.size),
    };
  }, [projects, images]);
}

/**
 * Which view is on: null until the script knows the pointer (CSS picks meanwhile); then the grid
 * on touch, without a wall, or by choice, else the wall.
 */
function viewFor(
  ready: boolean,
  wallAllowed: boolean,
  fine: boolean,
  choice: ViewKind | null,
): ViewKind | null {
  if (!ready) return null;
  if (!wallAllowed || !fine) return 'grid';
  return choice ?? 'wall';
}

/** The open image, and what happens when a lazily loaded part fails. */
function useOpenImage(projects: ReadonlyMap<string, ScreenProject>) {
  const [opened, setOpened] = useState<OpenRequest | null>(null);
  const [wallUnavailable, setWallUnavailable] = useState(false);
  const [dialogUnavailable, setDialogUnavailable] = useState(false);
  const open = useCallback<OpenPhoto>(
    (request) => {
      const place = projects.get(request.photo.placeId);
      if (place) setOpened({ ...request, place });
    },
    [projects],
  );
  const closed = useCallback(() => setOpened(null), []);
  const wallFailed = useCallback(() => setWallUnavailable(true), []);
  const dialogFailed = useCallback(() => {
    setDialogUnavailable(true);
    setOpened(null);
  }, []);
  return { opened, open, closed, wallUnavailable, wallFailed, dialogUnavailable, dialogFailed };
}

interface SwitchProps {
  readonly ready: boolean;
  readonly pressed: ViewKind;
  readonly wallButton: RefObject<HTMLButtonElement | null>;
  readonly onChoose: (view: ViewKind) => void;
}

/** Wall or Grid: toggle buttons, pressed once the script knows which shows. */
function ScreensSwitch({ ready, pressed, wallButton, onChoose }: SwitchProps): ReactElement {
  return (
    // biome-ignore lint/a11y/useSemanticElements: two toggle buttons, not form fields; a fieldset would add a legend and a form's semantics.
    <div role="group" aria-label="View" className={SWITCH_CLASS} data-screens-switch="">
      {VIEWS.map((item) => (
        <button
          key={item.value}
          ref={item.value === 'wall' ? wallButton : undefined}
          type="button"
          className={OPTION_CLASS}
          aria-pressed={ready ? pressed === item.value : undefined}
          onClick={() => onChoose(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Which view shows, as /places decides it: the wall on a mouse or trackpad (or the grid by
 * choice), the grid on touch with Wall opening the full-screen sheet, the grid alone below
 * WALL_MIN_SCREENS images or once the wall's code has failed.
 */
function useScreensView(count: number, wallUnavailable: boolean) {
  const ready = !useIsServerHtmlRender();
  const fine = useFinePointer();
  const [choice, setChoice] = useState<ViewKind | null>(null);
  const closeSheet = useCallback(() => setChoice('grid'), []);
  const wallAllowed = count >= WALL_MIN_SCREENS && !wallUnavailable;
  const view = viewFor(ready, wallAllowed, fine, choice);
  const sheetOpen = ready && !fine && wallAllowed && choice === 'wall';
  return {
    ready,
    view,
    sheetOpen,
    wallAllowed,
    showWall: view === null ? wallAllowed : view === 'wall',
    pressed: (view === 'wall' || sheetOpen ? 'wall' : 'grid') as ViewKind,
    start: ready ? 'ready' : wallAllowed ? 'either' : 'grid',
    setChoice,
    closeSheet,
  };
}

interface ScreensBarProps extends Omit<SwitchProps, 'onChoose'> {
  readonly wallAllowed: boolean;
  readonly onChoose: SwitchProps['onChoose'];
  /** '65 images from 25 projects'. */
  readonly label: string;
  readonly views: ReactNode;
}

/** The first row: Wall / Grid (when the wall is allowed), the count, then the view switch. */
function ScreensBar({ wallAllowed, label, views, ...toggle }: ScreensBarProps): ReactElement {
  return (
    <div className={BAR_CLASS} data-screens-bar="">
      {wallAllowed ? <ScreensSwitch {...toggle} /> : null}
      <p className={NOTE_CLASS}>{label}</p>
      {views}
    </div>
  );
}

/** What the wall, the grid and the sheet all take. */
interface SharedParts {
  readonly photos: readonly WallPhoto[];
  readonly places: ReadonlyMap<string, ScreenProject>;
  readonly placeCount: number;
  readonly onOpen: OpenPhoto;
}

interface ScreensBodyProps {
  readonly shared: SharedParts;
  readonly words: ReturnType<typeof useScreenWords>;
  /** Changes with the images shown, so the wall and the grid start over. */
  readonly resetKey: string;
  readonly view: ViewKind | null;
  readonly showWall: boolean;
  readonly sheetOpen: boolean;
  readonly enhance: boolean;
  readonly wallButton: RefObject<HTMLButtonElement | null>;
  readonly onWallFailed: () => void;
  readonly onCloseSheet: () => void;
}

/** The wall (or its frame), the grid, and the touch screen's Wall sheet, as the view says. */
function ScreensBody({
  shared,
  words,
  resetKey,
  view,
  showWall,
  sheetOpen,
  enhance,
  wallButton,
  onWallFailed,
  onCloseSheet,
}: ScreensBodyProps): ReactElement {
  return (
    <>
      {showWall ? (
        <div className={WALL_BLOCK_CLASS} data-wall-block="">
          <PhotoWall
            {...shared}
            {...words.wall}
            label={words.label}
            hint={SCREENS_WALL_HINTS.page}
            load={view === 'wall'}
            resetKey={resetKey}
            onUnavailable={onWallFailed}
          />
        </div>
      ) : null}
      {view === null || view === 'grid' ? (
        <div className={GRID_BLOCK_CLASS} data-grid-block="">
          <PhotoGrid key={resetKey} {...shared} {...words.grid} enhance={enhance} />
        </div>
      ) : null}
      {sheetOpen ? (
        <PhotoWallSheet
          {...shared}
          {...words.wall}
          label={words.label}
          hint={SCREENS_WALL_HINTS.sheet}
          title={words.sheetTitle}
          onClose={onCloseSheet}
          returnFocus={wallButton}
          onUnavailable={onWallFailed}
        />
      ) : null}
    </>
  );
}

/** Every image of the projects shown, as the wall or the grid, with the open image. */
export function ProjectScreens({ entries, views }: ProjectScreensProps): ReactElement {
  const photos = useMemo(() => screensOf(entries), [entries]);
  const projects = useMemo(() => screenProjectsOf(entries), [entries]);
  const words = useScreenWords(projects, photos.length);
  const resetKey = useMemo(() => photos.map((photo) => photo.key).join(' '), [photos]);
  const state = useOpenImage(projects);
  const { view, sheetOpen, ...shown } = useScreensView(photos.length, state.wallUnavailable);
  const wallButton = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  usePreloadOnIntent(rootRef);
  const shared = { photos, places: projects, placeCount: projects.size, onOpen: state.open };

  return (
    <div
      ref={rootRef}
      className={ROOT_CLASS}
      data-projects-view="screens"
      data-photos-view={view ?? 'auto'}
      data-start={shown.start}
    >
      <ScreensBar
        wallAllowed={shown.wallAllowed}
        ready={shown.ready}
        pressed={shown.pressed}
        wallButton={wallButton}
        onChoose={shown.setChoice}
        label={words.label}
        views={views}
      />
      <ScreensBody
        shared={shared}
        words={words}
        resetKey={resetKey}
        view={view}
        showWall={shown.showWall}
        sheetOpen={sheetOpen}
        enhance={!state.dialogUnavailable}
        wallButton={wallButton}
        onWallFailed={state.wallFailed}
        onCloseSheet={shown.closeSheet}
      />
      <PhotoDialog
        {...words.dialog}
        opened={state.opened}
        onClosed={state.closed}
        onUnavailable={state.dialogFailed}
      />
    </div>
  );
}
