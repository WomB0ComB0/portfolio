/**
 * Copyright (c) 2026 Mike Odnis
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Button classes in the console language. Focus is the one console ring (2px --focus outline,
 * offset 2px), matching the global :focus-visible rule; it replaces the old 1px box-shadow ring,
 * which also switched the outline off. A button that is busy but must keep focus (a browser drops
 * focus from a button that becomes `disabled`) sets aria-disabled instead, and looks the same.
 *
 * A `disabled` button fades whole, to half opacity; it can't take focus, so it never shows a ring.
 * An aria-disabled one keeps focus, and half opacity would fade its ring with it (8.9:1 down to
 * 3.0:1 on the canvas). So it fades whole only while its ring is hidden, looking exactly as a
 * disabled one does. While the ring shows (:focus-visible) the button stays opaque, so the ring is
 * at full strength, and its parts fade instead, keeping the same look:
 * - its words, mixed halfway to the canvas (-webkit-text-fill-color, which leaves the button's
 *   colour, and so its border and icons, alone): what half opacity made of them on the page, as
 *   words over a half fill at half alpha would take on the fill's colour (on a card's surface,
 *   a shade dimmer than that, as the canvas is darker);
 * - its icons, to half opacity, as the place photo viewer's are;
 * - its fill, for a variant drawn by its fill alone (default, destructive, secondary), and
 *   outline's hairline, to half alpha, which is what half opacity made of them. A caller that
 *   repaints one of those repaints this half too.
 * Outline's surface-1 fill stays: it is close to the canvas, and a half fill here would put a box
 * back behind the sign-out link, which repaints it transparent. Ghost and link have no fill. The
 * shadows stay too: half opacity halved them, so full and none are equally far off, and a 10%
 * black shadow is lost on the dark canvas either way.
 * The fades are not animated (no transition while aria-disabled, at rest too, so its hover colours
 * snap): with the opacity switching at once, a fill easing to its half would flash at full strength
 * as the ring came, and one easing back would dip below its rest look as the ring went.
 *
 * The default, secondary and destructive variants are drawn by their background alone, which
 * forced colours (Windows High Contrast) remove, leaving bare words. There they get a 1px border
 * in the system colour, so they still read as buttons; at the usual colours they have none and
 * keep their size. Outline has its border always; ghost and link read as text by design.
 */
const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
    'aria-disabled:cursor-not-allowed aria-disabled:transition-none aria-disabled:not-focus-visible:opacity-50',
    'aria-disabled:focus-visible:[-webkit-text-fill-color:color-mix(in_srgb,currentColor_50%,var(--color-canvas))] aria-disabled:focus-visible:[&_svg]:opacity-50',
  ].join(' '),
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow hover:bg-primary/90 forced-colors:border aria-disabled:focus-visible:bg-primary/50',
        destructive:
          'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 forced-colors:border aria-disabled:focus-visible:bg-destructive/50',
        outline:
          'border border-hairline bg-surface-1 hover:bg-surface-3 hover:text-foreground aria-disabled:focus-visible:border-hairline/50',
        secondary:
          'bg-surface-3 text-foreground hover:bg-surface-3/80 forced-colors:border aria-disabled:focus-visible:bg-surface-3/50',
        ghost: 'hover:bg-surface-3 hover:text-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
