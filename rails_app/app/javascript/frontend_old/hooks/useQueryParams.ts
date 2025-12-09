import { usePage, router } from "@inertiajs/react"; // Or your specific Inertia adapter
import { useCallback, useMemo } from "react";

/**
 * Helper function to convert a URLSearchParams instance into a plain object.
 * This is useful because router.get() expects a data object for query params.
 * Handles multiple values for the same key by creating an array.
 * @param {URLSearchParams} searchParams
 * @returns {Object}
 */
function searchParamsToObject(searchParams) {
  const obj = {};
  for (const [key, value] of searchParams.entries()) {
    // entries() gives all key-value pairs, handling multiple values for the same key correctly
    if (obj.hasOwnProperty(key)) {
      if (!Array.isArray(obj[key])) {
        obj[key] = [obj[key]]; // Convert to array if it's the second value for this key
      }
      obj[key].push(value);
    } else {
      obj[key] = value; // First value for this key
    }
  }
  return obj;
}

/**
 * A hook similar to React Router's useSearchParams.
 * Returns a [URLSearchParams, FunctionToSetSearchParams] tuple.
 *
 * The returned URLSearchParams object reflects the current URL's query string.
 * The returned function can be called to update the query string, triggering
 * an Inertia navigation.
 */
export function useQueryParams() {
  const { url: pagePathAndQuery } = usePage(); // e.g., "/users?page=1&sort=name"

  // Memoize the current URLSearchParams object.
  // page.url might be just a path, so use window.location.origin as base.
  const currentSearchParams = useMemo(() => {
    const fullUrl = new URL(pagePathAndQuery, window.location.origin);
    return fullUrl.searchParams;
  }, [pagePathAndQuery]);

  /**
   * Sets the search params and triggers an Inertia visit.
   * @param {URLSearchParamsInit | ((prev: URLSearchParams) => URLSearchParamsInit)} newParamsOrFn
   *   - URLSearchParamsInit: A URLSearchParams instance, a string, or an object (Record<string, string | string[]>).
   *                          This will REPLACE all current search params.
   *   - ((prev: URLSearchParams) => URLSearchParamsInit): A function that receives the current
   *     URLSearchParams (as a mutable copy) and should return the new params (URLSearchParams, string, or object).
   * @param {object} [visitOptionsOverrides={}] Optional Inertia visit options to merge.
   */
  const setSearchParams = useCallback(
    (newParamsOrFn, visitOptionsOverrides = {}) => {
      const currentFullUrl = new URL(pagePathAndQuery, window.location.origin);
      const pathnameOnly = currentFullUrl.pathname;

      let newSearchData = {};

      if (typeof newParamsOrFn === "function") {
        // Create a mutable copy for the updater function
        const mutableSearchParams = new URLSearchParams(currentSearchParams);
        const resultFromFn = newParamsOrFn(mutableSearchParams);
        // Convert the result (which could be URLSearchParams, object, string) to URLSearchParams, then to an object
        newSearchData = searchParamsToObject(new URLSearchParams(resultFromFn));
      } else {
        // newParamsOrFn is URLSearchParams, string, or object. Convert to URLSearchParams, then to an object.
        newSearchData = searchParamsToObject(new URLSearchParams(newParamsOrFn));
      }

      const mergedVisitOptions = {
        replace: true, // Replace history entry, common for filter changes
        preserveState: true, // Preserve local component state
        preserveScroll: true, // Preserve scroll position
        ...visitOptionsOverrides, // Allow user to override defaults
      };

      // Use router.get(), which takes the path and a data object for query params.
      // This ensures proper serialization of array params (e.g., key[]=value1&key[]=value2)
      // which is common for Rails and other backends.
      router.get(pathnameOnly, newSearchData, mergedVisitOptions);
    },
    [pagePathAndQuery, currentSearchParams] // Dependencies
  );

  return [currentSearchParams, setSearchParams];
}
