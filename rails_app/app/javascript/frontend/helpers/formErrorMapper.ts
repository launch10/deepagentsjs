import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { parseFieldNameFromApi } from "./fieldNameParser";

/**
 * Standard error response structure from the API.
 * Matches the Rails API error format for validation errors.
 *
 * Rails APIs can return errors in multiple formats:
 * - Record format: { errors: { field_name: ["error1", "error2"] } }
 * - Array format: { errors: ["error1", "error2"] }
 * - String format: { error: "Something went wrong" }
 */
export type ApiErrorResponse = {
  errors?: Record<string, string[]> | string[];
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
 * Handles three error formats from Rails APIs:
 * 1. Record format: { errors: { field_name: ["error1", "error2"] } } -> maps to specific fields
 * 2. Array format: { errors: ["error1", "error2"] } -> maps to root error
 * 3. String format: { error: "Something went wrong" } -> maps to root error
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

  if (!errorResponse) {
    return;
  }

  // Handle general error string: { error: "Something went wrong" }
  if (errorResponse.error) {
    methods.setError("root" as Path<TFormData>, {
      type: "server",
      message: errorResponse.error,
    });
    return;
  }

  if (!errorResponse.errors) {
    return;
  }

  // Handle array format: { errors: ["msg1", "msg2"] }
  if (Array.isArray(errorResponse.errors)) {
    if (errorResponse.errors.length === 0) {
      return;
    }
    const message = errorResponse.errors.join(", ");
    methods.setError("root" as Path<TFormData>, {
      type: "server",
      message,
    });
    return;
  }

  // Handle record format: { errors: { field: ["msg"] } }
  if (typeof errorResponse.errors === "object") {
    Object.entries(errorResponse.errors).forEach(([fieldName, messages]) => {
      const { fieldNameAndIndex, prettyFieldName } = parseFieldNameFromApi(fieldName);

      methods.setError(fieldNameAndIndex as Path<TFormData>, {
        type: "server",
        message: `${prettyFieldName} ${messages.join(", ")}`,
      });
    });
  }
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
