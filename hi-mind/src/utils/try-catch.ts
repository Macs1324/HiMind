/**
 * 
 * Usage:
 * // Sync
 * const [data, error] = tryCatch(() => riskyOperation());
 * if (error) return error;
 * 
 * // Async
 * const [data, error] = await tryCatch(async () => await riskyAsyncOperation());
 * if (error) return error;
 */

export type TryCatchResult<T> = [T, null] | [null, Error];

/**
 * Synchronous tryCatch - returns [data, null] on success or [null, error] on failure
 */
export function tryCatch<T>(fn: () => T): TryCatchResult<T> {
  try {
    const result = fn();
    return [result, null];
  } catch (error) {
    return [null, error instanceof Error ? error : new Error(String(error))];
  }
}

/**
 * Asynchronous tryCatch - returns [data, null] on success or [null, error] on failure
 */
export async function tryCatchAsync<T>(
  fn: () => Promise<T> | T
): Promise<TryCatchResult<T>> {
  try {
    const result = await fn();
    return [result, null];
  } catch (error) {
    return [null, error instanceof Error ? error : new Error(String(error))];
  }
}

/**
 * tryCatch with custom error transformation
 */
export function tryCatchWith<T, E extends Error = Error>(
  fn: () => T,
  errorTransformer: (error: unknown) => E
): [T, null] | [null, E] {
  try {
    const result = fn();
    return [result, null];
  } catch (error) {
    return [null, errorTransformer(error)];
  }
}

/**
 * tryCatch with custom error transformation (async)
 */
export async function tryCatchWithAsync<T, E extends Error = Error>(
  fn: () => Promise<T> | T,
  errorTransformer: (error: unknown) => E
): Promise<[T, null] | [null, E]> {
  try {
    const result = await fn();
    return [result, null];
  } catch (error) {
    return [null, errorTransformer(error)];
  }
}

/**
 * tryCatch that returns a default value on error
 */
export function tryCatchOrDefault<T>(
  fn: () => T,
  defaultValue: T
): T {
  try {
    return fn();
  } catch {
    return defaultValue;
  }
}

/**
 * tryCatch that returns a default value on error (async)
 */
export async function tryCatchOrDefaultAsync<T>(
  fn: () => Promise<T> | T,
  defaultValue: T
): Promise<T> {
  try {
    return await fn();
  } catch {
    return defaultValue;
  }
}

/**
 * tryCatch that logs errors automatically
 */
export function tryCatchWithLogging<T>(
  fn: () => T,
  context?: string
): TryCatchResult<T> {
  try {
    const result = fn();
    return [result, null];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const contextStr = context ? ` [${context}]` : '';
    console.error(`❌ Error${contextStr}:`, errorMessage);
    if (error instanceof Error && error.stack) {
      console.error('Stack trace:', error.stack);
    }
    return [null, error instanceof Error ? error : new Error(String(error))];
  }
}

/**
 * tryCatch that logs errors automatically (async)
 */
export async function tryCatchWithLoggingAsync<T>(
  fn: () => Promise<T> | T,
  context?: string
): Promise<TryCatchResult<T>> {
  try {
    const result = await fn();
    return [result, null];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const contextStr = context ? ` [${context}]` : '';
    console.error(`❌ Error${contextStr}:`, errorMessage);
    if (error instanceof Error && error.stack) {
      console.error('Stack trace:', error.stack);
    }
    return [null, error instanceof Error ? error : new Error(String(error))];
  }
}
