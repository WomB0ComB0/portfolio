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
 * @file React Testing Utilities
 * @description Custom render function and utilities for testing React components.
 */

import type { RenderOptions, RenderResult } from '@testing-library/react';
import { render } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';

interface WrapperProps {
  children: ReactNode;
}

/**
 * Custom wrapper that provides all necessary providers for testing.
 * Add your app's providers here (theme, query client, etc.)
 */
function AllTheProviders({ children }: WrapperProps) {
  // For now, return children directly
  // When you need providers, wrap them here:
  // return (
  //   <QueryClientProvider client={queryClient}>
  //     <ThemeProvider>
  //       {children}
  //     </ThemeProvider>
  //   </QueryClientProvider>
  // );
  return <>{children}</>;
}

/**
 * Custom render function that wraps components with necessary providers.
 * Use this instead of @testing-library/react's render.
 *
 * @example
 * import { customRender, screen } from '@/tests/setup/test-utils';
 *
 * it('renders component', () => {
 *   customRender(<MyComponent />);
 *   expect(screen.getByText('Hello')).toBeInTheDocument();
 * });
 */
function customRender(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>): RenderResult {
  return render(ui, { wrapper: AllTheProviders, ...options });
}

// Re-export everything from @testing-library/react
export * from '@testing-library/react';

// Override render with customRender
export { customRender as render };
