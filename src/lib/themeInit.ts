/** Where the visitor's own theme choice is remembered (absent = follow the device). */
export const THEME_STORAGE_KEY = "cc-theme";

/**
 * Sets <html data-theme> before first paint, so the page never flashes the
 * wrong theme: the saved choice if there is one, otherwise the device
 * setting. It is a string because it has to run inline in <head>, ahead of
 * every bundle. (Kept out of theme.ts, which is client-only, so the server
 * layout can import it.)
 */
export const THEME_INIT_SCRIPT =
  "(function(){var t='light';try{var s=localStorage.getItem('" +
  THEME_STORAGE_KEY +
  "');t=(s==='dark'||s==='light')?s:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');}catch(e){}" +
  "document.documentElement.setAttribute('data-theme',t);})();";
