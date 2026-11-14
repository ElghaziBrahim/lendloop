import { ConvexError } from "convex/values";

/**
 * Turn anything a Convex call can throw into one sentence a person can read.
 *
 * Server functions throw `ConvexError({ code, message })` for every rule they
 * enforce, so the message they wrote is the one shown. Anything else (a dropped
 * websocket, a deployment that is asleep) falls back to its own message.
 */
export function errorMessage(error: unknown): string {
  if (error instanceof ConvexError) {
    const data: unknown = error.data;

    if (typeof data === "string" && data.trim().length > 0) {
      return data;
    }

    if (data && typeof data === "object" && "message" in data) {
      const message = (data as { message?: unknown }).message;
      if (typeof message === "string" && message.trim().length > 0) {
        return message;
      }
    }
  }

  if (error instanceof Error && error.message) {
    // Network failures can carry a multi-line stack; the first line is the
    // useful part.
    return error.message.split("\n")[0] ?? error.message;
  }

  return "Something went wrong. Try again.";
}
