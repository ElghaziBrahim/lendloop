/**
 * Theme values, storage and the before-paint boot script.
 *
 * The design's dark palette already lives in `globals.css` under `.dark`; all
 * the runtime has to do is decide which side of that block applies. Nothing
 * here adds a colour or a dependency.
 *
 * The one rule the whole module protects: the class on `<html>` and the state
 * in `ThemeProvider` must be computed the same way, and both must survive a
 * browser where `localStorage` throws (Safari private mode, blocked storage).
 */

export const THEME_STORAGE_KEY = "lendloop-theme";

export const THEMES = ["system", "light", "dark"] as const;

export type Theme = (typeof THEMES)[number];

export type ResolvedTheme = Exclude<Theme, "system">;

export const DEFAULT_THEME: Theme = "system";

export const DARK_SCHEME_QUERY = "(prefers-color-scheme: dark)";

/**
 * The page ground in each scheme, mirrored as the browser chrome colour
 * (`theme-color`). These are the two `--background` values in globals.css; a
 * meta tag cannot resolve a CSS variable before the theme applies, so the pair
 * also lives here.
 */
export const THEME_COLORS: Record<ResolvedTheme, string> = {
  light: "#f6f2e9",
  dark: "#17150f",
};

export function isTheme(value: unknown): value is Theme {
  return (
    typeof value === "string" &&
    (THEMES as readonly string[]).includes(value)
  );
}

/** Anything missing or unrecognised falls back to `system`, the default. */
export function parseStoredTheme(value: string | null | undefined): Theme {
  return isTheme(value) ? value : DEFAULT_THEME;
}

export function resolveTheme(theme: Theme, prefersDark: boolean): ResolvedTheme {
  if (theme === "system") return prefersDark ? "dark" : "light";
  return theme;
}

export function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia(DARK_SCHEME_QUERY).matches;
  } catch {
    return false;
  }
}

export function readStoredTheme(): Theme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    return parseStoredTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

/** Best effort: a blocked write must not block the switch itself. */
export function storeTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage unavailable; the choice still holds for this tab.
  }
}

/**
 * Apply the resolved theme to the document: the class that selects the palette,
 * plus the browser chrome colour. Both follow the same resolved value, so the
 * address bar matches an explicit choice as well as the OS default.
 */
export function applyThemeClass(resolved: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLORS[resolved]);
}

/**
 * Runs synchronously in `<head>`, before the first paint.
 *
 * It reads the stored choice, falls back to the OS setting when the choice is
 * `system` (or missing/invalid), and toggles `.dark` on `<html>` plus the
 * `theme-color` meta. Every step is guarded: a throwing `localStorage` or an
 * absent `matchMedia` still leaves a defined theme instead of an exception in
 * the head.
 */
export const themeBootScript = `(function(){var root=document.documentElement;var stored=null;try{stored=window.localStorage.getItem("${THEME_STORAGE_KEY}")}catch(error){}var prefersDark=false;try{prefersDark=window.matchMedia("(prefers-color-scheme: dark)").matches}catch(error){}var dark=stored==="dark"||(stored!=="light"&&prefersDark);root.classList.toggle("dark",dark);var meta=document.querySelector('meta[name="theme-color"]');if(meta){meta.setAttribute("content",dark?"${THEME_COLORS.dark}":"${THEME_COLORS.light}")}})()`;
