/**
 * @fileoverview
 * TypeScript module declarations for importing various asset types (images, audio, video, JSON)
 * and global interface augmentations for browser APIs and React. These declarations enable
 * TypeScript-aware imports and type safety for static assets and custom browser features
 * used throughout the Product Decoder project.
 *
 * @copyright
 *   Copyright 2025 Product Decoder
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

import type React from 'react';

/**
 * Module declaration for PNG image imports.
 *
 * @module
 * @example
 *   import img, { ReactComponent } from './logo.png';
 *   // <ReactComponent /> renders the image as an inline SVG or <img>
 */
declare module '*.png' {
  /**
   * React component for rendering the PNG image.
   */
  export const ReactComponent: React.FC<React.ImgHTMLAttributes<HTMLImageElement>>;
  /**
   * The imported image as a URL string.
   */
  const content: string;
  export default content;
}

/**
 * Module declaration for WebP image imports.
 *
 * @module
 */
declare module '*.webp' {
  export const ReactComponent: React.FC<React.ImgHTMLAttributes<HTMLImageElement>>;
  const content: string;
  export default content;
}

/**
 * Module declaration for JPEG image imports (.jpg).
 *
 * @module
 */
declare module '*.jpg' {
  export const ReactComponent: React.FC<React.ImgHTMLAttributes<HTMLImageElement>>;
  const content: string;
  export default content;
}

/**
 * Module declaration for JPEG image imports (.jpeg).
 *
 * @module
 */
declare module '*.jpeg' {
  export const ReactComponent: React.FC<React.ImgHTMLAttributes<HTMLImageElement>>;
  const content: string;
  export default content;
}

/**
 * Module declaration for GIF image imports.
 *
 * @module
 */
declare module '*.gif' {
  export const ReactComponent: React.FC<React.ImgHTMLAttributes<HTMLImageElement>>;
  const content: string;
  export default content;
}

/**
 * Module declaration for AVIF image imports.
 *
 * @module
 */
declare module '*.avif' {
  export const ReactComponent: React.FC<React.ImgHTMLAttributes<HTMLImageElement>>;
  const content: string;
  export default content;
}

/**
 * Module declaration for SVG image imports.
 *
 * @module
 * @example
 *   import icon, { ReactComponent } from './icon.svg';
 *   // <ReactComponent /> renders the SVG as a React component
 */
declare module '*.svg' {
  /**
   * React component for rendering the SVG.
   */
  export const ReactComponent: React.FC<React.SVGProps<SVGSVGElement>>;
  /**
   * The imported SVG as a URL string.
   */
  const src: string;
  export default src;
}

/**
 * Module declaration for MP4 video imports.
 *
 * @module
 */
declare module '*.mp4' {
  /**
   * React component for rendering the MP4 video.
   */
  export const ReactComponent: React.FC<React.VideoHTMLAttributes<HTMLVideoElement>>;
  /**
   * The imported video as a URL string.
   */
  const src: string;
  export default src;
}

/**
 * Module declaration for WebM video imports.
 *
 * @module
 */
declare module '*.webm' {
  export const ReactComponent: React.FC<React.VideoHTMLAttributes<HTMLVideoElement>>;
  const src: string;
  export default src;
}

/**
 * Module declaration for MP3 audio imports.
 *
 * @module
 */
declare module '*.mp3' {
  export const ReactComponent: React.FC<React.AudioHTMLAttributes<HTMLAudioElement>>;
  const src: string;
  export default src;
}

/**
 * Module declaration for OGG audio imports.
 *
 * @module
 */
declare module '*.ogg' {
  export const ReactComponent: React.FC<React.AudioHTMLAttributes<HTMLAudioElement>>;
  const src: string;
  export default src;
}

/**
 * Module declaration for WAV audio imports.
 *
 * @module
 */
declare module '*.wav' {
  export const ReactComponent: React.FC<React.AudioHTMLAttributes<HTMLAudioElement>>;
  const src: string;
  export default src;
}

/**
 * Module declaration for AAC audio imports.
 *
 * @module
 */
declare module '*.aac' {
  export const ReactComponent: React.FC<React.AudioHTMLAttributes<HTMLAudioElement>>;
  const src: string;
  export default src;
}

/**
 * Module declaration for importing JSON files.
 *
 * @module
 * @example
 *   import data from './data.json';
 */
declare module '*.json' {
  /**
   * The imported JSON content.
   */
  const content: any;
  export default content;
}

/**
 * Global interface augmentations for browser APIs.
 *
 * @global
 */
declare global {
  /**
   * Augments the Document interface to support the View Transition API.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API
   */
  interface Document {
    /**
     * Initiates a view transition with a callback.
     * @param callback - Function to execute during the transition.
     */
    startViewTransition: (callback: () => void) => void;
  }

  /**
   * Augments the Window interface with custom properties and the View Transition API.
   */
  interface Window {
    location: Location;
    /**
     * Initiates a view transition with a callback.
     * @param callback - Function to execute during the transition.
     */
    startViewTransition: (callback: () => void) => void;
    /**
     * The current year (e.g., 2025).
     */
    currentYear: number;
    /**
     * The user's time zone (e.g., "America/New_York").
     */
    timeZone: string;
    /**
     * Indicates if the web app is mobile-web-app capable.
     */
    mobileWebAppCapable: boolean;
    /**
     * The theme color of the application.
     */
    themeColor: string;
    /**
     * The manifest URL or content.
     */
    manifest: string;
    /**
     * The base URL for metadata.
     */
    metadataBase: string;
    /**
     * Additional custom properties.
     */
    other: {
      currentYear: number;
      timeZone: string;
    };
  }
}

declare module 'react' {
  interface HTMLAttributes<T extends HTMLScriptElement>
    extends React.HTMLAttributes<T>,
      React.DOMAttributes<T> {
    strategy?: 'beforeInteractive' | 'afterInteractive';
  }
}
