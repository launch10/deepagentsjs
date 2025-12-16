import axios from "axios";

/**
 * Configured axios instance for API requests.
 * Provides consistent headers and configuration across all API calls.
 */
export const apiClient = axios.create({
  headers: {
    "Content-Type": "application/json",
  },
});
