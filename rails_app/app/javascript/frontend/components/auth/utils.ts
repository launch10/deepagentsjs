/**
 * Converts Inertia's error format to FieldError's expected format.
 */
export function toFieldErrors(
  errors: Record<string, string[]> | undefined,
  field: string
): Array<{ message: string }> | undefined {
  const messages = errors?.[field];
  if (!messages?.length) return undefined;
  return messages.map((message) => ({ message }));
}
