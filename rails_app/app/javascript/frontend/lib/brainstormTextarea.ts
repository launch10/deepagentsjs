/**
 * Module-level textarea ref management for brainstorm chat.
 * Allows focus management from outside React component tree (e.g., from BrainstormMessages).
 *
 * Note: Refs should not be stored in zustand as they are mutable objects.
 * This module provides a simple getter/setter pattern for external access.
 */
import type { RefObject } from "react";

let textareaRef: RefObject<HTMLTextAreaElement | null> = { current: null };

/**
 * Register the textarea ref. Called from BrainstormInput component.
 */
export function setTextareaRef(ref: RefObject<HTMLTextAreaElement | null>) {
  textareaRef = ref;
}

/**
 * Get the textarea ref for focus management.
 * Used by BrainstormMessages when clicking example suggestions.
 */
export function getTextareaRef(): RefObject<HTMLTextAreaElement | null> {
  return textareaRef;
}
