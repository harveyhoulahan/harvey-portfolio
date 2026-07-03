export const THEME_KEY = "theme";

export type ThemePreference = "light" | "dark" | "system";

export function getStoredTheme(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const value = localStorage.getItem(THEME_KEY);
  if (value === "light" || value === "dark") return value;
  return "system";
}

export function resolveTheme(preference: ThemePreference): "light" | "dark" {
  if (preference === "dark") return "dark";
  if (preference === "light") return "light";
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function getResolvedTheme(): "light" | "dark" {
  return resolveTheme(getStoredTheme());
}

export function applyTheme(preference: ThemePreference) {
  const resolved = resolveTheme(preference);
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.style.colorScheme = resolved;
}

export function setTheme(preference: "light" | "dark") {
  localStorage.setItem(THEME_KEY, preference);
  applyTheme(preference);
  window.dispatchEvent(new Event("theme-change"));
}

/** Inline before paint — avoids a flash of the wrong theme. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');document.documentElement.style.colorScheme=d?'dark':'light';}catch(e){}})();`;
