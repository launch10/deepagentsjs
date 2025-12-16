import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import type { AxiosError } from "axios";
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
  error: AxiosError<unknown>,
  methods: UseFormReturn<TFormData>
): void {
  const errorResponse = error.response?.data as ApiErrorResponse | undefined;

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
