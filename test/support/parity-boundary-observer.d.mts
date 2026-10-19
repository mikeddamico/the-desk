export function mark(event: string, fields?: Record<string, unknown>): void;
export function caseEntry(task: {
  name: string;
  suite?: { name: string; suite?: unknown };
}): void;
export function nativeCall<T>(
  boundary: string,
  executable: unknown,
  argv: unknown,
  invoke: () => T,
): T;
