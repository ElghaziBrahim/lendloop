import { ConvexError } from "convex/values";

/**
 * Text validation for user-supplied fields.
 *
 * The same rules run in the mutation, so a client that skips its own checks
 * cannot store a blank or oversized value.
 */

export const NAME_MAX = 80;
export const CATEGORY_MAX = 40;
export const DESCRIPTION_MAX = 500;
export const MESSAGE_MAX = 500;

function invalid(message: string): ConvexError<{ code: string; message: string }> {
  return new ConvexError({ code: "INVALID_ARGUMENT", message });
}

/** Trimmed, non-empty, bounded text. */
export function requireText(
  value: string,
  field: string,
  maxLength: number,
): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) throw invalid(`${field} cannot be empty.`);
  if (trimmed.length > maxLength) {
    throw invalid(`${field} must be ${maxLength} characters or fewer.`);
  }
  return trimmed;
}

/**
 * Optional text: trimmed, bounded, and `undefined` when blank so clearing a
 * description writes no empty string.
 */
export function optionalText(
  value: string | undefined,
  field: string,
  maxLength: number,
): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  if (trimmed.length > maxLength) {
    throw invalid(`${field} must be ${maxLength} characters or fewer.`);
  }
  return trimmed;
}
