import { describe, it, expect, vi, beforeEach } from "vitest";
import { mapApiErrorsToForm, clearServerErrors } from "../formErrorMapper";
import type { UseFormReturn, FieldValues } from "react-hook-form";

// Mock parseFieldNameFromApi
vi.mock("../fieldNameParser", () => ({
  parseFieldNameFromApi: (fieldName: string) => ({
    fieldNameAndIndex: fieldName,
    prettyFieldName: fieldName.charAt(0).toUpperCase() + fieldName.slice(1),
  }),
}));

// Helper to create a mock form methods object
function createMockMethods(): UseFormReturn<FieldValues> {
  return {
    setError: vi.fn(),
    clearErrors: vi.fn(),
    formState: {
      errors: {},
    },
  } as unknown as UseFormReturn<FieldValues>;
}

describe("formErrorMapper", () => {
  describe("mapApiErrorsToForm", () => {
    let mockMethods: UseFormReturn<FieldValues>;

    beforeEach(() => {
      mockMethods = createMockMethods();
    });

    describe("existing behavior - record format { errors: { field: [messages] } }", () => {
      it("maps field errors from record format", () => {
        const error = {
          response: {
            data: {
              errors: {
                name: ["is required", "must be at least 3 characters"],
              },
            },
          },
        };

        mapApiErrorsToForm(error, mockMethods);

        expect(mockMethods.setError).toHaveBeenCalledWith("name", {
          type: "server",
          message: "Name is required, must be at least 3 characters",
        });
      });

      it("handles multiple field errors", () => {
        const error = {
          response: {
            data: {
              errors: {
                name: ["is required"],
                email: ["is invalid"],
              },
            },
          },
        };

        mapApiErrorsToForm(error, mockMethods);

        expect(mockMethods.setError).toHaveBeenCalledTimes(2);
      });
    });

    describe("NEW: array format { errors: [messages] }", () => {
      it("maps array of error strings to root error", () => {
        const error = {
          response: {
            data: {
              errors: ["Campaign not found"],
            },
          },
        };

        mapApiErrorsToForm(error, mockMethods);

        expect(mockMethods.setError).toHaveBeenCalledWith("root", {
          type: "server",
          message: "Campaign not found",
        });
      });

      it("joins multiple error strings with commas", () => {
        const error = {
          response: {
            data: {
              errors: ["Budget is required", "Timezone is invalid"],
            },
          },
        };

        mapApiErrorsToForm(error, mockMethods);

        expect(mockMethods.setError).toHaveBeenCalledWith("root", {
          type: "server",
          message: "Budget is required, Timezone is invalid",
        });
      });

      it("handles empty array gracefully", () => {
        const error = {
          response: {
            data: {
              errors: [],
            },
          },
        };

        mapApiErrorsToForm(error, mockMethods);

        // Should not set any errors for empty array
        expect(mockMethods.setError).not.toHaveBeenCalled();
      });
    });

    describe("NEW: root error format { error: string }", () => {
      it("maps general error string to root error", () => {
        const error = {
          response: {
            data: {
              error: "Something went wrong",
            },
          },
        };

        mapApiErrorsToForm(error, mockMethods);

        expect(mockMethods.setError).toHaveBeenCalledWith("root", {
          type: "server",
          message: "Something went wrong",
        });
      });
    });

    describe("edge cases", () => {
      it("handles null error gracefully", () => {
        mapApiErrorsToForm(null, mockMethods);
        expect(mockMethods.setError).not.toHaveBeenCalled();
      });

      it("handles undefined error gracefully", () => {
        mapApiErrorsToForm(undefined, mockMethods);
        expect(mockMethods.setError).not.toHaveBeenCalled();
      });

      it("handles error with no response data", () => {
        const error = { response: {} };
        mapApiErrorsToForm(error, mockMethods);
        expect(mockMethods.setError).not.toHaveBeenCalled();
      });

      it("handles Error object with JSON in message", () => {
        const error = new Error('API Error: {"errors": ["Validation failed"]}');

        mapApiErrorsToForm(error, mockMethods);

        expect(mockMethods.setError).toHaveBeenCalledWith("root", {
          type: "server",
          message: "Validation failed",
        });
      });
    });
  });

  describe("clearServerErrors", () => {
    it("clears only server-type errors", () => {
      const mockMethods = {
        formState: {
          errors: {
            name: { type: "server", message: "Server error" },
            email: { type: "required", message: "Required" },
          },
        },
        clearErrors: vi.fn(),
      } as unknown as UseFormReturn<FieldValues>;

      clearServerErrors(mockMethods, ["name", "email"]);

      expect(mockMethods.clearErrors).toHaveBeenCalledWith("name");
      expect(mockMethods.clearErrors).not.toHaveBeenCalledWith("email");
    });
  });
});
