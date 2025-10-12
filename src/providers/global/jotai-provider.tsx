import { Provider } from 'jotai/react';
import type { ReactNode } from 'react';

/**
 * Type definition for a React component that can accept children
 * @template P - The props type for the component
 */
type ComponentWithChildren<P = {}> = React.ComponentType<P & { children?: ReactNode }>;

/**
 * Props interface for the JotaiProvider component
 * @template T - Component type that extends ComponentWithChildren
 * @property {T} Component - The React component to be wrapped with the Jotai Provider
 * @property {T extends ComponentWithChildren<infer P> ? P : never} [componentProps] - Optional props to pass to the wrapped component
 */
interface JotaiProviderProps<T extends ComponentWithChildren> {
  Component: T;
  componentProps?: T extends ComponentWithChildren<infer P> ? P : never;
}

/**
 * A higher-order component that wraps a given component with Jotai's Provider
 * This enables state management using Jotai atoms throughout the component tree
 *
 * @template T - Component type that extends ComponentWithChildren
 * @param {JotaiProviderProps<T>} props - The props object containing the component and its props
 * @param {T} props.Component - The React component to be wrapped
 * @param {T extends ComponentWithChildren<infer P> ? P : never} [props.componentProps] - Optional props for the wrapped component
 * @returns {JSX.Element} The wrapped component with Jotai Provider
 *
 * @example
 * ```tsx
 * const MyApp = ({ children }) => <div>{children}</div>;
 *
 * // Basic usage
 * <JotaiProvider Component={MyApp} />
 *
 * // With component props
 * <JotaiProvider
 *   Component={MyApp}
 *   componentProps={{ someProps: 'value' }}
 * />
 * ```
 */
export const JotaiProvider = <T extends ComponentWithChildren>({
  Component,
  componentProps,
}: JotaiProviderProps<T>) => {
  return (
    <Provider>
      <Component {...(componentProps as any)} />
    </Provider>
  );
};

JotaiProvider.displayName = 'JotaiProvider';
export default JotaiProvider;
