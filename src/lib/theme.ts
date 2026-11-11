"use client";

import { useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY } from "@/lib/themeInit";

/**
 * Light ("paper") and dark themes.
 *
 * The theme is the `data-theme` attribute on <html>; the colours themselves
 * live in globals.css. By default it follows the device setting. A visitor
 * who picks the other one with the header toggle has that choice remembered
 * on this device; picking the device's own setting again clears it, so the
 * site goes back to following the device.
 */

export type Theme = "light" | "dark";

const CHANGE_EVENT = "cc-themechange";

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function savedTheme(): Theme | null {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === "dark" || saved === "light" ? saved : null;
  } catch {
    return null;
  }
}

function currentTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

export function setTheme(theme: Theme): void {
  try {
    if (theme === systemTheme()) localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage blocked (private window, strict settings): the choice lasts for this page only.
  }
  document.documentElement.setAttribute("data-theme", theme);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  // The device setting changed (e.g. sunset): follow it unless the visitor chose a theme here.
  const onSystemChange = () => {
    if (savedTheme()) return;
    document.documentElement.setAttribute("data-theme", media.matches ? "dark" : "light");
    onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  media.addEventListener("change", onSystemChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    media.removeEventListener("change", onSystemChange);
  };
}

/** The theme currently showing. Re-renders the caller when it changes. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, currentTheme, () => "light");
}
