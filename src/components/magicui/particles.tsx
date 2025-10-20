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

'use client';

import type React from 'react';
import { useEffect, useRef, useState } from 'react';

/**
 * @interface MousePosition
 * @readonly
 * @description
 * Represents the x and y coordinates of the mouse pointer.
 * @author Mike Odnis
 * @version 1.0.0
 */
interface MousePosition {
  /** X coordinate of the mouse pointer */
  x: number;
  /** Y coordinate of the mouse pointer */
  y: number;
}

/**
 * Tracks and provides the current mouse position in the viewport.
 * @function
 * @public
 * @returns {MousePosition} Current mouse position as { x, y }.
 * @example
 *   const mouse = MousePosition();
 *   console.log(mouse.x, mouse.y);
 * @author Mike Odnis
 * @web
 * @version 1.0.0
 * @see https://developer.mozilla.org/docs/Web/API/MouseEvent
 */
function MousePosition(): MousePosition {
  const [mousePosition, setMousePosition] = useState<MousePosition>({
    x: 0,
    y: 0,
  });

  useEffect(() => {
    /**
     * Handles mousemove events and updates position state.
     * @param {MouseEvent} event - Mouse move event from the browser.
     */
    const handleMouseMove = (event: MouseEvent) => {
      setMousePosition({ x: event.clientX, y: event.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return mousePosition;
}

/**
 * @interface ParticlesProps
 * @public
 * @readonly
 * @description
 * Props for the Particles component.
 * @property {string} [className] - Additional container CSS classes.
 * @property {number} [quantity] - Number of particles on the canvas.
 * @property {number} [staticity] - Particle response to mouse movement.
 * @property {number} [ease] - Easing factor of particle animation.
 * @property {number} [size] - Base size of particles.
 * @property {boolean} [refresh] - Triggers manual particle regeneration.
 * @property {string} [color] - Fill color (HEX) for particles.
 * @property {number} [vx] - X-axis velocity for all particles.
 * @property {number} [vy] - Y-axis velocity for all particles.
 * @author Mike Odnis
 * @version 1.0.0
 */
interface ParticlesProps {
  className?: string;
  quantity?: number;
  staticity?: number;
  ease?: number;
  size?: number;
  refresh?: boolean;
  color?: string;
  vx?: number;
  vy?: number;
}

/**
 * Converts a HEX color string to an RGB array.
 * @function
 * @private
 * @param {string} hex - The HEX color string (supports 3 or 6 digits).
 * @returns {number[]} Array with [red, green, blue] values.
 * @throws {Error} If an invalid hex code is passed.
 * @example
 *   hexToRgb("#fff"); // [255, 255, 255]
 *   hexToRgb("#abcdef"); // [171, 205, 239]
 * @author Mike Odnis
 * @version 1.0.0
 * @see https://stackoverflow.com/a/5624139
 */
function hexToRgb(hex: string): number[] {
  hex = hex.replace('#', '');

  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((char) => char + char)
      .join('');
  }

  const hexInt = Number.parseInt(hex, 16);
  const red = (hexInt >> 16) & 255;
  const green = (hexInt >> 8) & 255;
  const blue = hexInt & 255;
  return [red, green, blue];
}

/**
 * MagicUI animated particles React component.
 * Renders an interactive canvas particle field that responds to mouse movement and configuration props.
 *
 * @function Particles
 * @public
 * @param {ParticlesProps} props - Particle system configuration and style.
 * @returns {React.ReactElement} Particles canvas element.
 * @author Mike Odnis
 * @web
 * @version 1.0.0
 * @see https://github.com/WomB0ComB0/portfolio
 * @example
 *   <Particles quantity={75} color="#560BAD" className="h-96 w-full" />
 */
const Particles: React.FC<ParticlesProps> = ({
  className = '',
  quantity = 100,
  staticity = 50,
  ease = 50,
  size = 0.4,
  refresh = false,
  color = '#ffffff',
  vx = 0,
  vy = 0,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const context = useRef<CanvasRenderingContext2D | null>(null);
  const circles = useRef<Circle[]>([]);
  const mousePosition = MousePosition();
  const mouse = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const canvasSize = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1;

  useEffect(() => {
    if (canvasRef.current) {
      context.current = canvasRef.current.getContext('2d');
    }
    /**
     * Initializes canvas and draws particles. Called initially and on color change.
     * @private
     */
    initCanvas();
    animate();
    window.addEventListener('resize', initCanvas);

    return () => {
      window.removeEventListener('resize', initCanvas);
    };
  }, [color]);

  useEffect(() => {
    onMouseMove();
  }, [mousePosition.x, mousePosition.y]);

  useEffect(() => {
    initCanvas();
  }, [refresh]);

  /**
   * @function initCanvas
   * @private
   * @description
   * Resizes the canvas and (re-)draws all particles.
   * @author Mike Odnis
   */
  const initCanvas = () => {
    resizeCanvas();
    drawParticles();
  };

  /**
   * @function onMouseMove
   * @private
   * @description
   * Updates mouse position relative to the canvas for interactive particle behavior.
   * @author Mike Odnis
   */
  const onMouseMove = () => {
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const { w, h } = canvasSize.current;
      const x = mousePosition.x - rect.left - w / 2;
      const y = mousePosition.y - rect.top - h / 2;
      const inside = x < w / 2 && x > -w / 2 && y < h / 2 && y > -h / 2;
      if (inside) {
        mouse.current.x = x;
        mouse.current.y = y;
      }
    }
  };

  /**
   * @typedef Circle
   * @private
   * @description
   * Shape instance used for particle simulation.
   * @property {number} x - X coordinate.
   * @property {number} y - Y coordinate.
   * @property {number} translateX - X translation for particle.
   * @property {number} translateY - Y translation for particle.
   * @property {number} size - Particle radius.
   * @property {number} alpha - Current opacity.
   * @property {number} targetAlpha - Target opacity.
   * @property {number} dx - X velocity.
   * @property {number} dy - Y velocity.
   * @property {number} magnetism - Mouse magnetism factor.
   */
  type Circle = {
    x: number;
    y: number;
    translateX: number;
    translateY: number;
    size: number;
    alpha: number;
    targetAlpha: number;
    dx: number;
    dy: number;
    magnetism: number;
  };

  /**
   * Resizes the canvas to match its container and adjusts drawing context for device pixel ratio.
   * @function
   * @private
   * @author Mike Odnis
   * @see https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/scale
   */
  const resizeCanvas = () => {
    if (canvasContainerRef.current && canvasRef.current && context.current) {
      circles.current.length = 0;
      canvasSize.current.w = canvasContainerRef.current.offsetWidth;
      canvasSize.current.h = canvasContainerRef.current.offsetHeight;
      canvasRef.current.width = canvasSize.current.w * dpr;
      canvasRef.current.height = canvasSize.current.h * dpr;
      canvasRef.current.style.width = `${canvasSize.current.w}px`;
      canvasRef.current.style.height = `${canvasSize.current.h}px`;
      context.current.scale(dpr, dpr);
    }
  };

  /**
   * Randomly generates new circle (particle) parameters.
   * @function
   * @private
   * @returns {Circle} New random particle instance.
   * @author Mike Odnis
   */
  const circleParams = (): Circle => {
    const x = Math.floor(Math.random() * canvasSize.current.w);
    const y = Math.floor(Math.random() * canvasSize.current.h);
    const translateX = 0;
    const translateY = 0;
    const pSize = Math.floor(Math.random() * 2) + size;
    const alpha = 0;
    const targetAlpha = Number.parseFloat((Math.random() * 0.6 + 0.1).toFixed(1));
    const dx = (Math.random() - 0.5) * 0.1;
    const dy = (Math.random() - 0.5) * 0.1;
    const magnetism = 0.1 + Math.random() * 4;
    return {
      x,
      y,
      translateX,
      translateY,
      size: pSize,
      alpha,
      targetAlpha,
      dx,
      dy,
      magnetism,
    };
  };

  const rgb = hexToRgb(color);

  /**
   * Draws a single particle circle on the canvas.
   * @function
   * @private
   * @param {Circle} circle Circle particle object.
   * @param {boolean} [update=false] If true, skips pushing to array.
   * @author Mike Odnis
   * @throws {Error} If the canvas 2D rendering context is unavailable.
   */
  const drawCircle = (circle: Circle, update = false) => {
    if (context.current) {
      const { x, y, translateX, translateY, size, alpha } = circle;
      context.current.translate(translateX, translateY);
      context.current.beginPath();
      context.current.arc(x, y, size, 0, 2 * Math.PI);
      context.current.fillStyle = `rgba(${rgb.join(', ')}, ${alpha})`;
      context.current.fill();
      context.current.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (!update) {
        circles.current.push(circle);
      }
    }
  };

  /**
   * Clears the entire canvas drawing area.
   * @function
   * @private
   * @author Mike Odnis
   */
  const clearContext = () => {
    if (context.current) {
      context.current.clearRect(0, 0, canvasSize.current.w, canvasSize.current.h);
    }
  };

  /**
   * Draws all particles according to set quantity.
   * @function
   * @private
   * @author Mike Odnis
   */
  const drawParticles = () => {
    clearContext();
    const particleCount = quantity;
    for (let i = 0; i < particleCount; i++) {
      const circle = circleParams();
      drawCircle(circle);
    }
  };

  /**
   * Remaps a value from one range to another.
   * @function
   * @private
   * @param {number} value The value to remap.
   * @param {number} start1 Source range start.
   * @param {number} end1 Source range end.
   * @param {number} start2 Destination range start.
   * @param {number} end2 Destination range end.
   * @returns {number} Remapped value, or 0 if result is negative.
   * @author Mike Odnis
   * @example
   *   remapValue(0.5, 0, 1, 0, 10); // 5
   */
  const remapValue = (
    value: number,
    start1: number,
    end1: number,
    start2: number,
    end2: number,
  ): number => {
    const remapped = ((value - start1) * (end2 - start2)) / (end1 - start1) + start2;
    return remapped > 0 ? remapped : 0;
  };

  /**
   * Animation loop for all particle motion, alpha changes, edge detection, and user interaction.
   * Uses requestAnimationFrame for smoothness.
   * @function
   * @private
   * @web
   * @author Mike Odnis
   * @see https://developer.mozilla.org/docs/Web/API/window/requestAnimationFrame
   */
  const animate = () => {
    clearContext();
    circles.current.forEach((circle: Circle, i: number) => {
      // Edge distance computation
      const edge = [
        circle.x + circle.translateX - circle.size, // left
        canvasSize.current.w - circle.x - circle.translateX - circle.size, // right
        circle.y + circle.translateY - circle.size, // top
        canvasSize.current.h - circle.y - circle.translateY - circle.size, // bottom
      ];
      const closestEdge = edge.reduce((a, b) => Math.min(a, b));
      const remapClosestEdge = Number.parseFloat(remapValue(closestEdge, 0, 20, 0, 1).toFixed(2));
      if (remapClosestEdge > 1) {
        circle.alpha += 0.02;
        if (circle.alpha > circle.targetAlpha) {
          circle.alpha = circle.targetAlpha;
        }
      } else {
        circle.alpha = circle.targetAlpha * remapClosestEdge;
      }
      circle.x += circle.dx + vx;
      circle.y += circle.dy + vy;
      circle.translateX +=
        (mouse.current.x / (staticity / circle.magnetism) - circle.translateX) / ease;
      circle.translateY +=
        (mouse.current.y / (staticity / circle.magnetism) - circle.translateY) / ease;

      drawCircle(circle, true);

      // Remove and respawn if out of bounds
      if (
        circle.x < -circle.size ||
        circle.x > canvasSize.current.w + circle.size ||
        circle.y < -circle.size ||
        circle.y > canvasSize.current.h + circle.size
      ) {
        circles.current.splice(i, 1);
        const newCircle = circleParams();
        drawCircle(newCircle);
      }
    });
    window.requestAnimationFrame(animate);
  };

  return (
    <div className={className} ref={canvasContainerRef} aria-hidden="true">
      <canvas ref={canvasRef} className="size-full" />
    </div>
  );
};

export default Particles;
