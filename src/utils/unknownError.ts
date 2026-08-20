/** Supabase Postgrest errors are plain objects, not `Error` instances. */
export function describeUnknownError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (error && typeof error === 'object') {
    const record = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const message = typeof record.message === 'string' ? record.message.trim() : '';
    if (message) {
      if (record.code === '42P01' || /does not exist/i.test(message)) {
        return 'Platform chat tables are missing. Apply migrations 0009–0014 in the Supabase SQL Editor.';
      }
      if (record.code === '42501' || /permission denied|row-level security/i.test(message)) {
        return 'You do not have access to this venue chat thread.';
      }
      if (/invalid input syntax for type uuid/i.test(message)) {
        return 'Select a venue thread to load platform chat.';
      }
      return message;
    }
  }
  return fallback;
}
