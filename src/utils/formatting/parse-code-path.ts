/**
 * Parses the code path and returns a formatted string with the current working directory,
 * file name, entity name (function, class, component, or decorator), and context.
 *
 * @template C - The type of the context parameter.
 * @template T - The type of the entity parameter (function, class, component, or decorator).
 * @param {C} context - The context to include in the formatted string.
 * @param {T} entity - The entity whose name will be included in the formatted string.
 *                     Can be a function, class, React component, or decorator.
 * @returns {string} The formatted string with the location and entity name.
 *
 * @example
 * ```typescript
 * function myFunction() {}
 * class MyClass {}
 * const MyComponent = () => null;
 * function myDecorator(target: any) {}
 *
 * parseCodePath('some context', myFunction);
 * // => "location: /current/dir/file.js @myFunction: some context"
 *
 * parseCodePath('class context', MyClass);
 * // => "location: /current/dir/file.js @MyClass: class context"
 *
 * parseCodePath('component context', MyComponent);
 * // => "location: /current/dir/file.js @MyComponent: component context"
 * ```
 */
export const parseCodePath = <C, T>(context: C, entity: T): string => {
  const entityName = extractEntityName(entity);
  const filePath = getFilePath();

  return `location: ${filePath} @${entityName}: ${context}`;
};

/**
 * Extracts the name from various entity types.
 * @param entity - The entity to extract the name from
 * @returns The extracted name or 'UnknownEntity' if unable to determine
 */
function extractEntityName<T>(entity: T): string {
  // Handle functions (including arrow functions stored in variables)
  if (typeof entity === 'function') {
    return entity.name || 'AnonymousFunction';
  }

  // Handle class instances
  if (typeof entity === 'object' && entity !== null) {
    const constructor = (entity as any).constructor;
    if (typeof constructor === 'function' && constructor.name) {
      return constructor.name;
    }
  }

  // Handle strings (for manual entity naming)
  if (typeof entity === 'string') {
    return entity;
  }

  // Handle symbols
  if (typeof entity === 'symbol') {
    return entity.toString();
  }

  return 'UnknownEntity';
}

/**
 * Gets the current file path, handling both Node.js and browser environments.
 * @returns The file path string
 */
function getFilePath(): string {
  try {
    // Node.js environment
    if (typeof __filename !== 'undefined') {
      return __filename;
    }

    // Browser environment - try to get from stack trace
    const stack = new Error().stack;
    if (stack) {
      const stackLine = stack.split('\n')[2]; // Get caller's line
      const match =
        stackLine?.match(/https?:\/\/[^)]+/) ||
        stackLine?.match(/file:\/\/[^)]+/) ||
        stackLine?.match(/at\s+(.+):\d+:\d+/);
      if (match) {
        return match[1] || match[0];
      }
    }

    // Fallback
    return process?.cwd?.() || 'unknown-location';
  } catch (error) {
    return 'unknown-location';
  }
}

// Alternative version with more detailed location info
export const parseCodePathDetailed = <C, T>(
  context: C,
  entity: T,
  options: {
    includeLineNumber?: boolean;
    includeTimestamp?: boolean;
    customPrefix?: string;
  } = {},
): string => {
  const entityName = extractEntityName(entity);
  const filePath = getFilePath();
  const prefix = options.customPrefix || 'location';

  let locationInfo = `${prefix}: ${filePath}`;

  if (options.includeLineNumber) {
    try {
      const stack = new Error().stack;
      const callerLine = stack?.split('\n')[2];
      const lineMatch = callerLine?.match(/:(\d+):\d+/);
      if (lineMatch) {
        locationInfo += `:${lineMatch[1]}`;
      }
    } catch {
      // Ignore errors in line number extraction
    }
  }

  if (options.includeTimestamp) {
    locationInfo += ` [${new Date().toISOString()}]`;
  }

  return `${locationInfo} @${entityName}: ${context}`;
};
