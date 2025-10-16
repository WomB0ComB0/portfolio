
/**
 * Parses and constructs a formatted string representing the code location, including the file path,
 * associated entity name (such as a function, class, component, or decorator), and human context.
 *
 * The result is useful for debugging, developer logging, and traceability—matching the entity (function, class, etc.)
 * and the context in source code references.
 *
 * @template C The type of the context value.
 * @template T The type of the entity parameter.
 * @param {C} context - A description, situation, or custom value relevant to this code path.
 * @param {T} entity - The entity whose name is included; may be a function, class, object, component, decorator, or their name.
 * @returns {string} A formatted string: "location: <path> @<entity>: <context>".
 * @throws {Error} This function does not throw directly, but see {@link getFilePath}, which may throw in rare stack-trace parsing errors.
 * @example
 * // Function usage
 * function myFunction() {}
 * parseCodePath('initialization', myFunction);
 * // => "location: /current/dir/file.js @myFunction: initialization"
 *
 * // Class usage
 * class MyClass {}
 * parseCodePath('instantiating MyClass', MyClass);
 * // => "location: ... @MyClass: instantiating MyClass"
 *
 * // String as entity
 * parseCodePath('some context', 'EntityAsString');
 * // => "location: ... @EntityAsString: some context"
 *
 * @author Mike Odnis
 * @author WomB0ComB0
 * @see parseCodePathDetailed
 * @see https://github.com/WomB0ComB0/portfolio
 * @readonly
 * @public
 * @version 1.0.0
 */
export const parseCodePath = <C, T>(context: C, entity: T): string => {
  const entityName = extractEntityName(entity);
  const filePath = getFilePath();

  return `location: ${filePath} @${entityName}: ${context}`;
};

/**
 * Extracts a standardized name from an entity, supporting functions, classes, instances, symbols, and strings.
 *
 * - For functions or classes, returns the function's/class's `name` or 'AnonymousFunction'
 * - For instances, extracts the class/constructor name
 * - For string entities, returns the string itself
 * - For symbols, returns their string representation
 * - Returns 'UnknownEntity' if no name is found
 *
 * @template T The type of the entity.
 * @param {T} entity - The entity to extract a name from.
 * @returns {string} The extracted name or 'UnknownEntity' if not determinable.
 * @example
 * extractEntityName(function test() {}); // 'test'
 * extractEntityName(class MyClass {}); // 'MyClass'
 * extractEntityName('ManualName'); // 'ManualName'
 * extractEntityName(Symbol('sym')); // 'Symbol(sym)'
 *
 * @author Mike Odnis
 * @readonly
 * @public
 * @version 1.0.0
 */
function extractEntityName<T>(entity: T): string {
  if (typeof entity === 'function') {
    return entity.name || 'AnonymousFunction';
  }
  if (typeof entity === 'object' && entity !== null) {
    const constructor = (entity as any).constructor;
    if (typeof constructor === 'function' && constructor.name) {
      return constructor.name;
    }
  }
  if (typeof entity === 'string') {
    return entity;
  }
  if (typeof entity === 'symbol') {
    return entity.toString();
  }
  return 'UnknownEntity';
}

/**
 * Attempts to determine the current file path in both Node.js and browser-like environments.
 * Utilizes `__filename` if available (Node), or parses the call stack when not.
 * Falls back to process.cwd() or 'unknown-location' if all else fails.
 *
 * @returns {string} The current file path, URL, or 'unknown-location'.
 * @throws {Error} Throws if unexpected errors occur in stack trace parsing (caught internally, returns 'unknown-location').
 * @example
 * getFilePath(); // "/Users/user/project/src/utils/formatting/parse-code-path.ts"
 *
 * @author Mike Odnis
 * @web
 * @readonly
 * @private
 * @version 1.0.0
 */
function getFilePath(): string {
  try {
    if (typeof __filename !== 'undefined') {
      return __filename;
    }
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
    return process?.cwd?.() || 'unknown-location';
  } catch (error) {
    return 'unknown-location';
  }
}

/**
 * Parses and constructs a detailed formatted location string, including file path, entity, and context,
 * with optional line number, ISO timestamp, and custom prefix control. Useful for enhanced debugging or audit logs.
 *
 * @template C The type of the context parameter.
 * @template T The type of entity (function, class, etc.).
 * @param {C} context - Context description of the operation or location.
 * @param {T} entity - The entity whose name is included.
 * @param {object} [options] - Optional configuration for output.
 * @param {boolean} [options.includeLineNumber] - If true, appends the call site line number.
 * @param {boolean} [options.includeTimestamp] - If true, appends an ISO 8601 timestamp.
 * @param {string}  [options.customPrefix] - Custom prefix instead of default "location".
 * @returns {string} Detailed formatted location string.
 * @throws {Error} Does not throw directly but relies on internal getFilePath logic.
 * @example
 * parseCodePathDetailed('init', MyClass, {includeLineNumber: true, includeTimestamp: true});
 * // => "location: ...:42 [2024-06-01T08:00:00.000Z] @MyClass: init"
 *
 * @author Mike Odnis
 * @author WomB0ComB0
 * @see parseCodePath
 * @see https://github.com/WomB0ComB0/portfolio
 * @readonly
 * @public
 * @version 1.0.0
 */
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

