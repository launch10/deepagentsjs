import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { parseFieldNameFromApi } from "./fieldNameParser";

/**
 * Standard error response structure from the API.
 * Matches the Rails API error format for validation errors.
 */
export type ApiErrorResponse = {
  errors?: Record<string, string[]>;
  error?: string;
};

/**
 * Type guard to check if error has axios-like response structure
 */
function hasAxiosResponse(error: unknown): error is { response?: { data?: unknown } } {
  return typeof error === "object" && error !== null && "response" in error;
}

/**
 * Extracts API error response from various error types.
 * Handles both Axios errors (with response.data) and service errors (with message containing JSON).
 */
function extractErrorResponse(error: unknown): ApiErrorResponse | undefined {
  // Handle Axios-style errors
  if (hasAxiosResponse(error)) {
    return error.response?.data as ApiErrorResponse | undefined;
  }

  // Handle service errors that embed JSON in the message
  if (error instanceof Error && error.message) {
    const jsonMatch = error.message.match(/:\s*(\{.*\})$/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]) as ApiErrorResponse;
      } catch {
        // Not valid JSON, ignore
      }
    }
  }

  return undefined;
}

/**
 * Maps API validation errors to react-hook-form field errors.
 * Parses nested API field names and sets appropriate error messages.
 *
 * @example
 * ```tsx
 * autosaveMutation.mutate(data, {
 *   onError: (error) => mapApiErrorsToForm(error, methods),
 * });
 * ```
 */
export function mapApiErrorsToForm<TFormData extends FieldValues>(
  error: unknown,
  methods: UseFormReturn<TFormData>
): void {
  const errorResponse = extractErrorResponse(error);

  if (!errorResponse?.errors || typeof errorResponse.errors !== "object") {
    return;
  }

  Object.entries(errorResponse.errors).forEach(([fieldName, messages]) => {
    const { fieldNameAndIndex, prettyFieldName } = parseFieldNameFromApi(fieldName);

    methods.setError(fieldNameAndIndex as Path<TFormData>, {
      type: "server",
      message: `${prettyFieldName} ${messages.join(", ")}`,
    });
  });
}

/**
 * Clears all server-side errors from the form.
 * Useful when retrying a submission or resetting the form state.
 */
export function clearServerErrors<TFormData extends FieldValues>(
  methods: UseFormReturn<TFormData>,
  fieldNames: Array<Path<TFormData>>
): void {
  fieldNames.forEach((fieldName) => {
    const error = methods.formState.errors[fieldName as string];
    if (error && (error as { type?: string }).type === "server") {
      methods.clearErrors(fieldName);
    }
  });
}
