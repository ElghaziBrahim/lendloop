"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { cx } from "@/components/ui";
import { useTheme } from "@/components/theme/ThemeProvider";
import type { Theme } from "@/lib/theme";
import type { KeyboardEvent } from "react";

/**
 * The theme menu shared by the public header and the signed-in header.
 *
 * One compact icon button opens a three-item radio menu. The trigger carries a
 * stable accessible name ("Change theme") rather than the current value, so
 * the server HTML and the hydrated HTML agree even when the stored choice is
 * dark; the state is announced by `aria-checked` on the items instead.
 *
 * The icon is switched by CSS (`dark:hidden` / `hidden dark:block`), which
 * means it follows the class on `<html>` from the boot script with no React
 * render in the way and therefore no flash and no hydration mismatch.
 *
 * Keyboard: Enter/Space/ArrowDown open, arrows and Home/End move, Escape and
 * Tab close (returning focus to the trigger), and the items are real buttons so
 * Enter/Space select.
 */

const OPTIONS: ReadonlyArray<{ value: Theme; label: string }> = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [openIndex, setOpenIndex] = useState(0);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  const openMenu = useCallback(() => {
    const index = OPTIONS.findIndex((option) => option.value === theme);
    setOpenIndex(index === -1 ? 0 : index);
    setOpen(true);
  }, [theme]);

  const focusItem = useCallback((index: number) => {
    const count = OPTIONS.length;
    itemRefs.current[((index % count) + count) % count]?.focus();
  }, []);

  // Move focus into the menu once it exists.
  useEffect(() => {
    if (!open) return;
    itemRefs.current[openIndex]?.focus();
  }, [open, openIndex]);

  // A click anywhere outside closes the menu.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      if (!open) return;
      event.preventDefault();
      close(true);
      return;
    }

    if (!open) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        openMenu();
      }
      return;
    }

    const current = itemRefs.current.findIndex(
      (item) => item === document.activeElement,
    );

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusItem(current + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusItem(current - 1);
        break;
      case "Home":
        event.preventDefault();
        focusItem(0);
        break;
      case "End":
        event.preventDefault();
        focusItem(OPTIONS.length - 1);
        break;
      case "Tab":
        // Close, hand focus back to the trigger, then let Tab move on from it.
        close(true);
        break;
      default:
        break;
    }
  };

  const choose = (value: Theme) => {
    setTheme(value);
    setOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <div
      ref={containerRef}
      onKeyDown={onKeyDown}
      className="relative shrink-0"
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label="Change theme"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          if (open) setOpen(false);
          else openMenu();
        }}
        className="inline-flex size-9 items-center justify-center rounded-sm border border-input bg-card text-foreground transition-colors hover:border-rule-dark hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <SunIcon className="size-[15px] dark:hidden" />
        <MoonIcon className="hidden size-[15px] dark:block" />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Theme"
          className="absolute top-[calc(100%+6px)] right-0 z-50 w-[168px] rounded-sm border border-border bg-popover p-1 shadow-[0_10px_30px_rgba(20,16,8,0.18)]"
        >
          {OPTIONS.map((option, index) => {
            const checked = option.value === theme;

            return (
              <button
                key={option.value}
                ref={(element) => {
                  itemRefs.current[index] = element;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={checked}
                tabIndex={-1}
                onClick={() => choose(option.value)}
                className={cx(
                  "flex w-full items-center justify-between gap-2 rounded-[3px] px-2.5 py-2 text-left text-[13px] font-medium transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                  checked ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {option.label}
                {checked ? (
                  <CheckIcon className="size-3.5 text-primary" />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d="M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5a8.5 8.5 0 1 0 11.1 11.1Z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d="m4.5 12.5 5 5 10-11" />
    </svg>
  );
}
