import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME,
  THEME_COLORS,
  THEME_STORAGE_KEY,
  isTheme,
  parseStoredTheme,
  resolveTheme,
  themeBootScript,
} from "../src/lib/theme";

/**
 * The theme runtime's two contracts: which value wins, and what the before-paint
 * script does with `<html>`. The second is checked by running the real script
 * string against a stub document, so a change to the script is exercised here
 * rather than only observed in a browser.
 */

describe("theme values", () => {
  it("stores under the documented key", () => {
    expect(THEME_STORAGE_KEY).toBe("lendloop-theme");
  });

  it("accepts exactly light, dark and system", () => {
    for (const value of ["light", "dark", "system"] as const) {
      expect(isTheme(value)).toBe(true);
    }

    for (const value of ["Light", "", null, undefined, 0, "sepia"]) {
      expect(isTheme(value)).toBe(false);
    }
  });

  it("treats a missing or unknown stored value as system", () => {
    expect(DEFAULT_THEME).toBe("system");
    expect(parseStoredTheme(null)).toBe("system");
    expect(parseStoredTheme(undefined)).toBe("system");
    expect(parseStoredTheme("sepia")).toBe("system");
    expect(parseStoredTheme("light")).toBe("light");
    expect(parseStoredTheme("dark")).toBe("dark");
  });

  it("resolves system from the OS and keeps an explicit choice", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
  });

  it("mirrors the two --background tokens as chrome colours", () => {
    const css = readFileSync(
      new URL("../src/app/globals.css", import.meta.url),
      "utf8",
    );

    expect(THEME_COLORS.light).toBe("#f6f2e9");
    expect(THEME_COLORS.dark).toBe("#17150f");
    expect(css).toContain(`--background: ${THEME_COLORS.light};`);
    expect(css).toContain(`--background: ${THEME_COLORS.dark};`);
  });
});

type BootEnvironment = {
  stored?: string | null;
  prefersDark?: boolean;
  storageThrows?: boolean;
  matchMediaThrows?: boolean;
};

type BootResult = {
  classes: Set<string>;
  themeColor: string | null;
};

function runBootScript(env: BootEnvironment = {}): BootResult {
  const classes = new Set<string>();
  let themeColor: string | null = null;

  const metaStub = {
    setAttribute(name: string, value: string) {
      if (name === "content") themeColor = value;
    },
  };

  const documentStub = {
    documentElement: {
      classList: {
        toggle(name: string, force?: boolean) {
          if (force) classes.add(name);
          else classes.delete(name);
          return Boolean(force);
        },
      },
    },
    querySelector(selector: string) {
      return selector === 'meta[name="theme-color"]' ? metaStub : null;
    },
  };

  const windowStub = {
    localStorage: {
      getItem() {
        if (env.storageThrows) throw new Error("storage blocked");
        return env.stored ?? null;
      },
    },
    matchMedia() {
      if (env.matchMediaThrows) throw new Error("matchMedia unavailable");
      return { matches: env.prefersDark ?? false };
    },
  };

  runInNewContext(themeBootScript, { window: windowStub, document: documentStub });

  return { classes, themeColor };
}

describe("theme boot script", () => {
  it("applies a stored dark choice even when the OS is light", () => {
    const { classes } = runBootScript({ stored: "dark", prefersDark: false });
    expect(classes.has("dark")).toBe(true);
  });

  it("keeps a stored light choice even when the OS is dark", () => {
    const { classes } = runBootScript({ stored: "light", prefersDark: true });
    expect(classes.has("dark")).toBe(false);
  });

  it("follows the OS when the choice is system or absent", () => {
    expect(
      runBootScript({ stored: "system", prefersDark: true }).classes.has("dark"),
    ).toBe(true);
    expect(
      runBootScript({ stored: null, prefersDark: true }).classes.has("dark"),
    ).toBe(true);
    expect(
      runBootScript({ stored: null, prefersDark: false }).classes.has("dark"),
    ).toBe(false);
  });

  it("treats an unknown stored value as system", () => {
    const { classes } = runBootScript({ stored: "sepia", prefersDark: true });
    expect(classes.has("dark")).toBe(true);
  });

  it("survives a throwing localStorage and still follows the OS", () => {
    const { classes } = runBootScript({ storageThrows: true, prefersDark: true });
    expect(classes.has("dark")).toBe(true);
  });

  it("survives a missing matchMedia and paints light", () => {
    const { classes } = runBootScript({ matchMediaThrows: true });
    expect(classes.has("dark")).toBe(false);
  });

  it("sets the browser chrome colour from the resolved theme", () => {
    expect(
      runBootScript({ stored: "dark", prefersDark: false }).themeColor,
    ).toBe(THEME_COLORS.dark);
    expect(
      runBootScript({ stored: "light", prefersDark: true }).themeColor,
    ).toBe(THEME_COLORS.light);
    expect(
      runBootScript({ stored: "system", prefersDark: true }).themeColor,
    ).toBe(THEME_COLORS.dark);
    expect(
      runBootScript({ stored: "system", prefersDark: false }).themeColor,
    ).toBe(THEME_COLORS.light);
  });
});
