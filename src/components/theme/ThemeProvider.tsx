"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DARK_SCHEME_QUERY,
  THEME_STORAGE_KEY,
  applyThemeClass,
  parseStoredTheme,
  readStoredTheme,
  resolveTheme,
  storeTheme,
  systemPrefersDark,
  type ResolvedTheme,
  type Theme,
} from "@/lib/theme";

/**
 * The theme runtime: one provider, three choices, no dependency.
 *
 * The server has no access to `localStorage` or the OS setting, so it renders
 * the document as light. The inline boot script in `layout.tsx` corrects the
 * class before paint; this provider then owns every change after that:
 *
 * - a stored choice is read in a lazy initializer, the same source the boot
 *   script reads, so React's first state matches the DOM;
 * - the class is applied in a layout effect, which also restores it after a
 *   development-mode remount resets `<html>` to the attributes React manages;
 * - a `storage` event keeps other tabs in step;
 * - a `matchMedia` listener keeps `system` following the OS live.
 */

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

// `useLayoutEffect` warns during server rendering, where it can never run.
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);
  const [prefersDark, setPrefersDark] = useState(systemPrefersDark);

  const resolvedTheme = resolveTheme(theme, prefersDark);

  useIsomorphicLayoutEffect(() => {
    applyThemeClass(resolvedTheme);
  }, [resolvedTheme]);

  // The OS can change while the page is open; `system` must follow it.
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;

    const media = window.matchMedia(DARK_SCHEME_QUERY);
    const onChange = (event: MediaQueryListEvent) => {
      setPrefersDark(event.matches);
    };

    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  // Another tab changed the choice, or cleared it.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== THEME_STORAGE_KEY) return;
      setThemeState(parseStoredTheme(event.newValue));
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    storeTheme(next);
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);

  if (value === null) {
    throw new Error("useTheme must be used inside <ThemeProvider>.");
  }

  return value;
}
