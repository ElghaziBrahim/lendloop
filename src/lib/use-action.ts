"use client";

import { useCallback, useState } from "react";
import { errorMessage } from "./convex-error";

/**
 * One action at a time per panel, with the three things every form needs:
 * which control is busy, the server's error, and a success line.
 *
 * `key` identifies the control ("approve:abc123") so only that button shows a
 * spinner while the rest of the list stays usable.
 */
export function useAction() {
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = useCallback(
    async (
      key: string,
      action: () => Promise<unknown>,
      success?: string,
    ): Promise<boolean> => {
      setPendingKey(key);
      setError(null);
      setNotice(null);
      try {
        await action();
        if (success) setNotice(success);
        return true;
      } catch (cause) {
        setError(errorMessage(cause));
        return false;
      } finally {
        setPendingKey(null);
      }
    },
    [],
  );

  const clear = useCallback(() => {
    setError(null);
    setNotice(null);
  }, []);

  return { pendingKey, error, notice, run, clear };
}
